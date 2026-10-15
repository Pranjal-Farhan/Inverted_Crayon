-- Replay protection for authenticator codes: the last TOTP step accepted for the account.
ALTER TABLE "AdminUser" ADD COLUMN "twoFactorLastStep" INTEGER;
