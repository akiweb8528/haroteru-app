package repositories

import (
	"fmt"
	"math"

	"haroteru/backend/internal/models"

	"gorm.io/gorm"
)

type TrackedSubscriptionRepository struct {
	db *gorm.DB
}

func NewTrackedSubscriptionRepository(db *gorm.DB) *TrackedSubscriptionRepository {
	return &TrackedSubscriptionRepository{db: db}
}

type SubscriptionFilter struct {
	Search         string
	Category       string
	BillingCycle   string
	ReviewPriority string
	Locked         *bool
	SortBy         string
	SortOrder      string
	Page           int
	Limit          int
}

type DashboardSummary struct {
	MonthlyEstimate  int64 `json:"monthlyEstimate"`
	YearlyEstimate   int64 `json:"yearlyEstimate"`
	SubscriptionCount int64 `json:"subscriptionCount"`
	LockedCount      int64 `json:"lockedCount"`
	ReviewCount      int64 `json:"reviewCount"`
}

type SubscriptionListResult struct {
	Subscriptions []models.TrackedSubscription
	Total         int64
	Summary       DashboardSummary
}

func (r *TrackedSubscriptionRepository) List(userID string, f SubscriptionFilter) (*SubscriptionListResult, error) {
	query := r.db.Model(&models.TrackedSubscription{}).Where("user_id = ?", userID)

	if f.Search != "" {
		pattern := "%" + f.Search + "%"
		query = query.Where("name ILIKE ? OR note ILIKE ?", pattern, pattern)
	}
	if f.Category != "" {
		query = query.Where("category = ?", f.Category)
	}
	if f.BillingCycle != "" {
		query = query.Where("billing_cycle = ?", f.BillingCycle)
	}
	if f.ReviewPriority != "" {
		query = query.Where("review_priority = ?", f.ReviewPriority)
	}
	if f.Locked != nil {
		query = query.Where("locked = ?", *f.Locked)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("counting tracked subscriptions: %w", err)
	}

	sortField := "position"
	switch f.SortBy {
	case "name", "amount_yen", "billing_cycle", "review_priority", "position", "created_at":
		sortField = f.SortBy
	}
	order := "asc"
	if f.SortOrder == "desc" {
		order = "desc"
	}

	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Page <= 0 {
		f.Page = 1
	}
	offset := (f.Page - 1) * f.Limit

	var subscriptions []models.TrackedSubscription
	if err := query.Order(sortField + " " + order + ", created_at asc").Offset(offset).Limit(f.Limit).Find(&subscriptions).Error; err != nil {
		return nil, fmt.Errorf("listing tracked subscriptions: %w", err)
	}

	summary, err := r.Summary(userID)
	if err != nil {
		return nil, err
	}

	return &SubscriptionListResult{Subscriptions: subscriptions, Total: total, Summary: *summary}, nil
}

func (r *TrackedSubscriptionRepository) Summary(userID string) (*DashboardSummary, error) {
	var subscriptions []models.TrackedSubscription
	if err := r.db.Where("user_id = ?", userID).Find(&subscriptions).Error; err != nil {
		return nil, fmt.Errorf("loading tracked subscriptions for summary: %w", err)
	}

	var monthlyEstimate int64
	var yearlyEstimate int64
	var lockedCount int64
	var reviewCount int64

	for _, item := range subscriptions {
		if item.BillingCycle == models.BillingCycleYearly {
			yearlyEstimate += int64(item.AmountYen)
			monthlyEstimate += int64(math.Round(float64(item.AmountYen) / 12.0))
		} else {
			monthlyEstimate += int64(item.AmountYen)
			yearlyEstimate += int64(item.AmountYen * 12)
		}
		if item.Locked {
			lockedCount++
		}
		if item.ReviewPriority == models.PriorityLow {
			reviewCount++
		}
	}

	return &DashboardSummary{
		MonthlyEstimate:   monthlyEstimate,
		YearlyEstimate:    yearlyEstimate,
		SubscriptionCount: int64(len(subscriptions)),
		LockedCount:       lockedCount,
		ReviewCount:       reviewCount,
	}, nil
}

func (r *TrackedSubscriptionRepository) CountByUserID(userID string) (int64, error) {
	var count int64
	if err := r.db.Model(&models.TrackedSubscription{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("counting tracked subscriptions by user_id: %w", err)
	}
	return count, nil
}

func (r *TrackedSubscriptionRepository) FindByID(id, userID string) (*models.TrackedSubscription, error) {
	var item models.TrackedSubscription
	if err := r.db.First(&item, "id = ? AND user_id = ?", id, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("finding tracked subscription: %w", err)
	}
	return &item, nil
}

func (r *TrackedSubscriptionRepository) Create(item *models.TrackedSubscription) error {
	var maxPos int
	r.db.Model(&models.TrackedSubscription{}).Where("user_id = ?", item.UserID).Select("COALESCE(MAX(position), -1)").Scan(&maxPos)
	item.Position = maxPos + 1

	if err := r.db.Create(item).Error; err != nil {
		return fmt.Errorf("creating tracked subscription: %w", err)
	}
	return nil
}

func (r *TrackedSubscriptionRepository) Update(item *models.TrackedSubscription, fields map[string]any) error {
	if err := r.db.Model(item).Updates(fields).Error; err != nil {
		return fmt.Errorf("updating tracked subscription: %w", err)
	}
	return nil
}

func (r *TrackedSubscriptionRepository) Delete(id, userID string) error {
	result := r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.TrackedSubscription{})
	if result.Error != nil {
		return fmt.Errorf("deleting tracked subscription: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

type ReorderItem struct {
	ID       string
	Position int
}

func (r *TrackedSubscriptionRepository) Reorder(userID string, items []ReorderItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			if err := tx.Model(&models.TrackedSubscription{}).
				Where("id = ? AND user_id = ?", item.ID, userID).
				Update("position", item.Position).Error; err != nil {
				return fmt.Errorf("reordering tracked subscription %s: %w", item.ID, err)
			}
		}
		return nil
	})
}
