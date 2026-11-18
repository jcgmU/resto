-- Add CHECK constraints for ordering domain invariants
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 99);
ALTER TABLE "Order" ADD CONSTRAINT "order_total_check" CHECK ("total" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount_check" CHECK ("amount" >= 0);
