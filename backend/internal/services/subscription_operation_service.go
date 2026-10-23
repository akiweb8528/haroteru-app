package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"haroteru/backend/internal/repositories"
)

func (s *TrackedSubscriptionService) WithContext(ctx context.Context) *TrackedSubscriptionService {
	return NewTrackedSubscriptionService(s.subscriptions.(*repositories.TrackedSubscriptionRepository).WithContext(ctx)).WithValidator(s.validate)
}

// WithValidator validates new mutations inside the receipt transaction, after replay lookup.
func (s *TrackedSubscriptionService) WithValidator(validate func(any) error) *TrackedSubscriptionService {
	copy := *s
	copy.validate = validate
	return &copy
}

func (s *TrackedSubscriptionService) validateInput(input any) error {
	if s.validate != nil {
		return s.validate(input)
	}
	return nil
}

func (s *TrackedSubscriptionService) runOperation(userID, operationID, kind, id string, input any, execute func(*TrackedSubscriptionService) (any, error), output any) error {
	request, err := json.Marshal(struct {
		Kind  string
		ID    string
		Input any
	}{kind, id, input})
	if err != nil {
		return err
	}
	hash := sha256.Sum256(request)
	repo, ok := s.subscriptions.(*repositories.TrackedSubscriptionRepository)
	if !ok {
		return fmt.Errorf("operation receipts require a transactional repository")
	}
	response, err := repo.RunOperation(userID, operationID, hex.EncodeToString(hash[:]), func(tx *repositories.TrackedSubscriptionRepository) ([]byte, error) {
		result, err := execute(NewTrackedSubscriptionService(tx).WithValidator(s.validate))
		if err != nil {
			return nil, err
		}
		return json.Marshal(result)
	})
	if err != nil {
		return err
	}
	if output == nil {
		return nil
	}
	return json.Unmarshal(response, output)
}
