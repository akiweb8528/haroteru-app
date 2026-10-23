package repositories

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"regexp"

	"gorm.io/gorm"
)

var (
	ErrOperationConflict  = errors.New("operation identity has already been used for a different request")
	ErrInvalidOperationID = errors.New("invalid operation identity")
	operationIDPattern    = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,128}$`)
)

func (r *TrackedSubscriptionRepository) WithContext(ctx context.Context) *TrackedSubscriptionRepository {
	return NewTrackedSubscriptionRepository(r.db.WithContext(ctx))
}

// RunOperation commits the mutation and its replay response in the same transaction.
// Receipts outlive deleted subscriptions so a late retry cannot recreate or reapply them.
func (r *TrackedSubscriptionRepository) RunOperation(userID, operationID, requestHash string, execute func(*TrackedSubscriptionRepository) ([]byte, error)) ([]byte, error) {
	if !operationIDPattern.MatchString(operationID) {
		return nil, ErrInvalidOperationID
	}
	var response []byte
	err := r.db.Transaction(func(tx *gorm.DB) error {
		lockHash := sha256.Sum256([]byte(userID + ":" + operationID))
		lockID := int64(binary.BigEndian.Uint64(lockHash[:8]))
		if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", lockID).Error; err != nil {
			return fmt.Errorf("locking subscription operation: %w", err)
		}
		var receipt struct {
			RequestHash string
			Response    string
		}
		result := tx.Raw("SELECT request_hash, response::text FROM subscription_operation_receipts WHERE user_id = ? AND operation_id = ?", userID, operationID).Scan(&receipt)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			if receipt.RequestHash != requestHash {
				return ErrOperationConflict
			}
			response = []byte(receipt.Response)
			return nil
		}
		var err error
		response, err = execute(NewTrackedSubscriptionRepository(tx))
		if err != nil {
			return err
		}
		return tx.Exec("INSERT INTO subscription_operation_receipts (user_id, operation_id, request_hash, response) VALUES (?, ?, ?, ?::jsonb)", userID, operationID, requestHash, string(response)).Error
	})
	return response, err
}
