UPDATE alert_rules
   SET warning_threshold = 0.99,
       critical_threshold = 0.5,
       description = 'Some or all probes in the window could not reach the service'
 WHERE name = 'Service unreachable'
   AND service_id IS NULL;

DELETE FROM alert_events
 WHERE rule_id IN (
     SELECT id FROM alert_rules WHERE name = 'Service unreachable' AND service_id IS NULL
 );

DELETE FROM alert_states
 WHERE rule_id IN (
     SELECT id FROM alert_rules WHERE name = 'Service unreachable' AND service_id IS NULL
 );
