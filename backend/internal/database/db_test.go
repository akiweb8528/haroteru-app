package database

import "testing"

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
