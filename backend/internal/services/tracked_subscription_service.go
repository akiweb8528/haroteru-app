package services

import (
	"fmt"

	"haroteru/backend/internal/models"
	"haroteru/backend/internal/repositories"
)

type subscriptionRepository interface {
	List(userID string, f repositories.SubscriptionFilter) (*repositories.SubscriptionListResult, error)
	Create(item *models.TrackedSubscription) error
	FindByID(id, userID string) (*models.TrackedSubscription, error)
	Update(item *models.TrackedSubscription, fields map[string]any) error
	Delete(id, userID string) error
	Reorder(userID string, items []repositories.ReorderItem) error
	Summary(userID string) (*repositories.DashboardSummary, error)
}

type TrackedSubscriptionService struct {
	subscriptions subscriptionRepository
}

func NewTrackedSubscriptionService(subscriptions *repositories.TrackedSubscriptionRepository) *TrackedSubscriptionService {
	return &TrackedSubscriptionService{subscriptions: subscriptions}
}

type ListMeta struct {
	Page       int                           `json:"page"`
	Limit      int                           `json:"limit"`
	Total      int64                         `json:"total"`
	TotalPages int64                         `json:"totalPages"`
	Summary    repositories.DashboardSummary `json:"summary"`
}

type SubscriptionListResponse struct {
	Data []models.TrackedSubscription `json:"data"`
	Meta ListMeta                     `json:"meta"`
}

type CreateTrackedSubscriptionInput struct {
	Name           string                       `json:"name" validate:"required,min=1,max=120"`
	AmountYen      int                          `json:"amountYen" validate:"required,min=1,max=1000000"`
	BillingCycle   models.BillingCycle         `json:"billingCycle" validate:"required,oneof=monthly yearly"`
	Category       models.SubscriptionCategory `json:"category" validate:"required,oneof=video music productivity learning shopping lifestyle utilities other"`
	ReviewPriority models.ReviewPriority       `json:"reviewPriority" validate:"required,oneof=low medium high"`
	Locked         bool                         `json:"locked"`
	BillingDay     *int                         `json:"billingDay" validate:"omitempty,min=1,max=31"`
	Note           string                       `json:"note" validate:"max=500"`
}

type UpdateTrackedSubscriptionInput struct {
	Name           *string                      `json:"name" validate:"omitempty,min=1,max=120"`
	AmountYen      *int                         `json:"amountYen" validate:"omitempty,min=1,max=1000000"`
	BillingCycle   *models.BillingCycle        `json:"billingCycle" validate:"omitempty,oneof=monthly yearly"`
	Category       *models.SubscriptionCategory `json:"category" validate:"omitempty,oneof=video music productivity learning shopping lifestyle utilities other"`
	ReviewPriority *models.ReviewPriority      `json:"reviewPriority" validate:"omitempty,oneof=low medium high"`
	Locked         *bool                        `json:"locked"`
	BillingDay     *int                         `json:"billingDay" validate:"omitempty,min=1,max=31"`
	ClearBillingDay bool                        `json:"clearBillingDay"`
	Note           *string                      `json:"note" validate:"omitempty,max=500"`
}

type ReorderInput struct {
	Items []struct {
		ID       string `json:"id" validate:"required"`
		Position int    `json:"position" validate:"min=0"`
	} `json:"items" validate:"required,min=1"`
}

func (s *TrackedSubscriptionService) List(userID string, f repositories.SubscriptionFilter) (*SubscriptionListResponse, error) {
	result, err := s.subscriptions.List(userID, f)
	if err != nil {
		return nil, err
	}

	totalPages := result.Total / int64(f.Limit)
	if result.Total%int64(f.Limit) != 0 {
		totalPages++
	}

	return &SubscriptionListResponse{
		Data: result.Subscriptions,
		Meta: ListMeta{
			Page:       f.Page,
			Limit:      f.Limit,
			Total:      result.Total,
			TotalPages: totalPages,
			Summary:    result.Summary,
		},
	}, nil
}

func (s *TrackedSubscriptionService) Create(userID string, input *CreateTrackedSubscriptionInput) (*models.TrackedSubscription, error) {
	item := &models.TrackedSubscription{
		UserID:         userID,
		Name:           input.Name,
		AmountYen:      input.AmountYen,
		BillingCycle:   input.BillingCycle,
		Category:       input.Category,
		ReviewPriority: input.ReviewPriority,
		Locked:         input.Locked,
		BillingDay:     input.BillingDay,
		Note:           input.Note,
	}

	if err := s.subscriptions.Create(item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *TrackedSubscriptionService) GetByID(id, userID string) (*models.TrackedSubscription, error) {
	return s.subscriptions.FindByID(id, userID)
}

func (s *TrackedSubscriptionService) Update(id, userID string, input *UpdateTrackedSubscriptionInput) (*models.TrackedSubscription, error) {
	item, err := s.subscriptions.FindByID(id, userID)
	if err != nil {
		return nil, err
	}

	fields := map[string]any{}
	if input.Name != nil {
		fields["name"] = *input.Name
	}
	if input.AmountYen != nil {
		fields["amount_yen"] = *input.AmountYen
	}
	if input.BillingCycle != nil {
		fields["billing_cycle"] = *input.BillingCycle
	}
	if input.Category != nil {
		fields["category"] = *input.Category
	}
	if input.ReviewPriority != nil {
		fields["review_priority"] = *input.ReviewPriority
	}
	if input.Locked != nil {
		fields["locked"] = *input.Locked
	}
	if input.ClearBillingDay {
		fields["billing_day"] = nil
	} else if input.BillingDay != nil {
		fields["billing_day"] = *input.BillingDay
	}
	if input.Note != nil {
		fields["note"] = *input.Note
	}

	if len(fields) == 0 {
		return item, nil
	}
	if err := s.subscriptions.Update(item, fields); err != nil {
		return nil, err
	}

	updated, err := s.subscriptions.FindByID(id, userID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *TrackedSubscriptionService) Delete(id, userID string) error {
	return s.subscriptions.Delete(id, userID)
}

func (s *TrackedSubscriptionService) Reorder(userID string, input *ReorderInput) error {
	items := make([]repositories.ReorderItem, len(input.Items))
	for i, item := range input.Items {
		items[i] = repositories.ReorderItem{ID: item.ID, Position: item.Position}
	}
	return s.subscriptions.Reorder(userID, items)
}

func (s *TrackedSubscriptionService) Summary(userID string) (*repositories.DashboardSummary, error) {
	summary, err := s.subscriptions.Summary(userID)
	if err != nil {
		return nil, fmt.Errorf("loading subscription summary: %w", err)
	}
	return summary, nil
}
