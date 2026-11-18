-- Add CHECK constraints for catalog invariants
ALTER TABLE "Product" ADD CONSTRAINT "product_price_check" CHECK ("price" >= 0);
