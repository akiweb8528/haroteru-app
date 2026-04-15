package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"haroteru/backend/internal/config"
	"haroteru/backend/internal/database"
	"haroteru/backend/internal/handlers"
	"haroteru/backend/internal/middleware"
	"haroteru/backend/internal/repositories"
	"haroteru/backend/internal/router"
	"haroteru/backend/internal/services"
	jwtpkg "haroteru/backend/pkg/jwt"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

func main() {
	loadEnv()

	cfg := config.Load()

	logger, err := newLogger(cfg.IsProduction())
	if err != nil {
		log.Fatalf("failed to initialize logger: %v", err)
	}
	defer logger.Sync() //nolint:errcheck

	logger.Info("connecting to database")
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}

	sqlDB, err := db.DB()
	if err != nil {
		logger.Fatal("failed to get sql.DB", zap.Error(err))
	}
	defer sqlDB.Close()

	logger.Info("running database migrations")
	if err := database.RunMigrations(cfg.DatabaseURL); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	jwtSvc := jwtpkg.NewService(cfg.JWTSecret)
	userRepo := repositories.NewUserRepository(db)
	trackedSubscriptionRepo := repositories.NewTrackedSubscriptionRepository(db)

	authSvc := services.NewAuthService(cfg, jwtSvc, userRepo)
	userSvc := services.NewUserService(userRepo, trackedSubscriptionRepo)
	trackedSubscriptionSvc := services.NewTrackedSubscriptionService(trackedSubscriptionRepo)

	healthHandler := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(authSvc)
	userHandler := handlers.NewUserHandler(userSvc)
	trackedSubscriptionHandler := handlers.NewTrackedSubscriptionHandler(trackedSubscriptionSvc)

	authMW := middleware.NewAuthMiddleware(jwtSvc)

	e := echo.New()
	router.Setup(e, authMW, healthHandler, authHandler, userHandler, trackedSubscriptionHandler, cfg.FrontendURL, cfg.IsProduction(), cfg.DevAuthEnabled)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("server started", zap.String("addr", srv.Addr), zap.String("env", cfg.Environment))
		if err := e.StartServer(srv); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown error", zap.Error(err))
	}
	logger.Info("server stopped")
}

func loadEnv() {
	candidates := []string{
		".env",
		"../.env",
		filepath.Join("..", "..", ".env"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			_ = godotenv.Load(candidate)
		}
	}
}

func newLogger(production bool) (*zap.Logger, error) {
	if production {
		return zap.NewProduction()
	}
	return zap.NewDevelopment()
}
