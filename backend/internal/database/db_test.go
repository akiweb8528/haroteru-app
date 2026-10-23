package database

import (
	"errors"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/hashicorp/go-multierror"
)

func TestNormalizeDatabaseURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "keeps local postgres url unchanged",
			in:   "postgres://user:pass@localhost:5432/haroteru?sslmode=disable",
			want: "postgres://user:pass@localhost:5432/haroteru?sslmode=disable",
		},
		{
			name: "adds sslmode require for neon url",
			in:   "postgres://user:pass@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/haroteru",
			want: "postgres://user:pass@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/haroteru?sslmode=require",
		},
		{
			name: "preserves existing sslmode on neon url",
			in:   "postgres://user:pass@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/haroteru?sslmode=verify-full",
			want: "postgres://user:pass@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/haroteru?sslmode=verify-full",
		},
		{
			name: "leaves unparsable value unchanged",
			in:   "not a url",
			want: "not a url",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := normalizeDatabaseURL(tt.in); got != tt.want {
				t.Fatalf("normalizeDatabaseURL(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestNormalizeMigrationDatabaseURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "switches postgres scheme to pgx5",
			in:   "postgres://user:pass@localhost:5432/haroteru?sslmode=disable",
			want: "pgx5://user:pass@localhost:5432/haroteru?default_query_exec_mode=simple_protocol&sslmode=disable",
		},
		{
			name: "adds sslmode require for neon url",
			in:   "postgres://user:pass@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/haroteru",
			want: "pgx5://user:pass@ep-cool-darkness-123456.ap-southeast-1.aws.neon.tech/haroteru?default_query_exec_mode=simple_protocol&sslmode=require",
		},
		{
			name: "preserves explicit migration query mode",
			in:   "postgres://user:pass@localhost:5432/haroteru?default_query_exec_mode=cache_statement",
			want: "pgx5://user:pass@localhost:5432/haroteru?default_query_exec_mode=cache_statement",
		},
		{
			name: "leaves unparsable value unchanged",
			in:   "not a url",
			want: "not a url",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := normalizeMigrationDatabaseURL(tt.in); got != tt.want {
				t.Fatalf("normalizeMigrationDatabaseURL(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestIsIgnorableMigrationError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "ignores no change",
			err:  migrate.ErrNoChange,
			want: true,
		},
		{
			name: "ignores no change with advisory unlock prepared statement error",
			err: multierror.Append(
				migrate.ErrNoChange,
				errors.New("pq: unnamed prepared statement does not exist in line 0: SELECT pg_advisory_unlock($1)"),
			),
			want: true,
		},
		{
			name: "does not ignore migration failure",
			err: multierror.Append(
				migrate.ErrNoChange,
				errors.New("pq: relation subscriptions does not exist"),
			),
			want: false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isIgnorableMigrationError(tt.err); got != tt.want {
				t.Fatalf("isIgnorableMigrationError(%v) = %v, want %v", tt.err, got, tt.want)
			}
		})
	}
}
