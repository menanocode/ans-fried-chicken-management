
-- ============================================
-- TRIGGER: Recalculate ALL HPP when config changes
-- ============================================

CREATE OR REPLACE FUNCTION on_hpp_config_change()
RETURNS TRIGGER AS }
BEGIN
  PERFORM recalculate_all_hpp();
  RETURN NEW;
END;
} LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_hpp_config_change ON hpp_cost_config;

CREATE TRIGGER tr_on_hpp_config_change
  AFTER INSERT OR UPDATE ON hpp_cost_config
  FOR EACH STATEMENT
  EXECUTE FUNCTION on_hpp_config_change();

