package models

import "time"

type BillingCycle string

type SubscriptionCategory string

type ReviewPriority string

const (
	BillingCycleMonthly BillingCycle = "monthly"
	BillingCycleYearly  BillingCycle = "yearly"

	CategoryVideo        SubscriptionCategory = "video"
	CategoryMusic        SubscriptionCategory = "music"
	CategoryProductivity SubscriptionCategory = "productivity"
	CategoryLearning     SubscriptionCategory = "learning"
	CategoryShopping     SubscriptionCategory = "shopping"
	CategoryLifestyle    SubscriptionCategory = "lifestyle"
	CategoryUtilities    SubscriptionCategory = "utilities"
	CategoryOther        SubscriptionCategory = "other"

	PriorityLow    ReviewPriority = "low"
	PriorityMedium ReviewPriority = "medium"
	PriorityHigh   ReviewPriority = "high"
)

type TrackedSubscription struct {
	ID            string               `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID        string               `gorm:"type:uuid;not null;index"                     json:"userId"`
	Name          string               `gorm:"not null"                                     json:"name"`
	AmountYen     int                  `gorm:"column:amount_yen;not null"                   json:"amountYen"`
	BillingCycle  BillingCycle         `gorm:"column:billing_cycle;type:billing_cycle;not null;default:'monthly'" json:"billingCycle"`
	Category      SubscriptionCategory `gorm:"type:subscription_category;not null;default:'other'"              json:"category"`
	ReviewPriority ReviewPriority      `gorm:"column:review_priority;type:review_priority;not null;default:'medium'" json:"reviewPriority"`
	Locked        bool                 `gorm:"not null;default:false"                       json:"locked"`
	BillingDay    *int                 `gorm:"column:billing_day"                           json:"billingDay,omitempty"`
	Note          string               `gorm:"not null;default:''"                          json:"note"`
	Position      int                  `gorm:"not null;default:0"                           json:"position"`
	CreatedAt     time.Time            `json:"createdAt"`
	UpdatedAt     time.Time            `json:"updatedAt"`
}

func (TrackedSubscription) TableName() string { return "tracked_subscriptions" }
