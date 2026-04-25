-- ============================================================
-- Migration 017 — Role dictionary, ~165 new specialties, role-specialty mappings
--
-- Creates a role taxonomy (26 roles) that groups specialties into
-- recruiter-friendly categories like "Software Engineer",
-- "Aerospace Engineer", "Robotics Engineer". Each specialty maps
-- to one primary role (and optionally secondary roles).
-- ============================================================

-- ── STEP 1: role_dictionary table ───────────────────────────────────────────

CREATE TABLE role_dictionary (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL UNIQUE,
  role_description text,
  display_order smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE role_specialty_map (
  role_id uuid NOT NULL REFERENCES role_dictionary(role_id) ON DELETE CASCADE,
  specialty_normalized text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, specialty_normalized)
);

CREATE INDEX idx_role_specialty_map_role ON role_specialty_map(role_id);
CREATE INDEX idx_role_specialty_map_specialty ON role_specialty_map(specialty_normalized);

-- ── STEP 2: Insert 26 roles ────────────────────────────────────────────────

INSERT INTO role_dictionary (role_name, role_description, display_order) VALUES
  ('Software Engineer',                  'Software development across the stack — backend, frontend, mobile, ML, infra, DevOps', 1),
  ('Embedded / Firmware Engineer',       'Firmware, RTOS, bare-metal, and low-level software close to hardware', 2),
  ('Hardware Engineer',                  'PCB design, hardware integration, electromechanical prototyping', 3),
  ('Electrical Engineer',                'Circuit design, analog/digital/mixed-signal, power electronics', 4),
  ('Mechanical Engineer',                'Mechanical design, structural analysis, thermal, fluid dynamics', 5),
  ('RF / Wireless Engineer',             'Radio frequency, antenna, microwave, radar, satcom engineering', 6),
  ('FPGA / ASIC / Chip Engineer',        'FPGA/ASIC design, verification, SoC architecture, physical design', 7),
  ('Aerospace Engineer',                 'Avionics, GNC, propulsion, flight dynamics, orbital mechanics', 8),
  ('Systems Engineer',                   'Systems architecture, requirements, MBSE, integration across disciplines', 9),
  ('Controls Engineer',                  'Control systems, autonomy, guidance, navigation engineering', 10),
  ('Robotics Engineer',                  'Robotic perception, manipulation, navigation, ROS, autonomous systems', 11),
  ('Manufacturing / Production Engineer','Manufacturing process, DFM, tooling, assembly, production engineering', 12),
  ('Test / Reliability / Quality Engineer','Hardware/software test, HIL/SIL, qualification, failure analysis, certification', 13),
  ('Optics / Photonics Engineer',        'Optical design, photonics, imaging systems, laser engineering', 14),
  ('Materials Engineer',                 'Materials science, composites, metallurgy, polymers, ceramics', 15),
  ('Mechatronics Engineer',              'Mechatronic systems combining mechanical, electrical, and software', 16),
  ('Engineering Leadership',             'Engineering managers, directors, VPs, CTOs, principal/distinguished engineers', 17),
  ('Product Manager',                    'Product management across B2B, consumer, platform, growth, technical', 18),
  ('Designer',                           'Product design, UX, UI, brand, motion, research, industrial design', 19),
  ('Operator',                           'Business operations, strategy, RevOps, finance ops, program management', 20),
  ('Sales / GTM',                        'Sales, partnerships, BD, solutions engineering, customer success', 21),
  ('Marketing / Growth',                 'Product marketing, growth, brand, content, demand gen, communications', 22),
  ('Recruiter / Talent',                 'Technical recruiting, talent ops, people ops, HRBP, compensation', 23),
  ('Finance',                            'FP&A, accounting, treasury, investor relations, corporate development', 24),
  ('Legal',                              'Legal counsel, regulatory affairs, IP, contracts, compliance', 25),
  ('Founder',                            'Company founders, co-founders, founding team members', 26);


-- ── STEP 3: Insert ~165 new specialties ─────────────────────────────────────
-- Uses ON CONFLICT DO NOTHING so existing specialties from earlier migrations
-- are preserved unchanged.

-- Software Engineer specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('embedded_software',      'engineering', 'Embedded software for microcontrollers and processors, typically at hardware/IoT companies', true),
  ('real_time_systems',      'engineering', 'Real-time software with hard timing constraints, typically at aerospace/defense companies', true),
  ('rtos_engineering',       'engineering', 'RTOS development and integration, typically at embedded systems companies', true),
  ('low_level_systems',      'engineering', 'Low-level systems programming close to the OS/kernel, typically at infrastructure companies', true),
  ('kernel_engineering',     'engineering', 'Operating system kernel development, typically at OS/platform companies', true),
  ('driver_engineering',     'engineering', 'Device driver development for hardware interfaces, typically at hardware/semiconductor companies', true),
  ('bootloader_engineering', 'engineering', 'Bootloader and early-stage firmware development, typically at embedded systems companies', true),
  ('distributed_systems',    'engineering', 'Distributed systems design and implementation, typically at cloud/infrastructure companies', true),
  ('simulation_software',    'engineering', 'Physics and engineering simulation software, typically at aerospace/automotive companies', true),
  ('ground_software',        'engineering', 'Ground control station and mission operations software, typically at space/aerospace companies', true),
  ('mission_software',       'engineering', 'Mission-critical software for vehicles and systems, typically at aerospace/defense companies', true),
  ('autonomy_software',      'engineering', 'Autonomy stacks for vehicles and robots, typically at autonomous systems companies', true),
  ('perception_software',    'engineering', 'Perception pipelines for sensor data processing, typically at AV/robotics companies', true),
  ('controls_software',      'engineering', 'Software implementation of control algorithms, typically at robotics/aerospace companies', true),
  ('robotics_software',      'engineering', 'Software for robotic systems integration, typically at robotics companies', true),
  ('motion_planning',        'engineering', 'Motion and path planning for robots and vehicles, typically at robotics/AV companies', true),
  ('slam',                   'engineering', 'Simultaneous localization and mapping, typically at robotics/AV companies', true),
  ('sensor_fusion',          'engineering', 'Multi-sensor data fusion algorithms, typically at AV/aerospace companies', true),
  ('ml_infrastructure',      'engineering', 'ML training infrastructure and serving systems, typically at AI companies', true),
  ('ml_ops',                 'engineering', 'MLOps pipelines, model deployment and monitoring, typically at ML-heavy companies', true),
  ('applied_ml',             'engineering', 'Applied machine learning for product features, typically at tech companies', true),
  ('data_platform',          'engineering', 'Data platform and warehouse engineering, typically at data-intensive companies', true),
  ('analytics_engineering',  'engineering', 'Analytics engineering with dbt/SQL/BI tools, typically at data-driven companies', true),
  ('api_engineering',        'engineering', 'API design and development, typically at platform/SaaS companies', true),
  -- Mechanical
  ('mechanical_design',      'engineering', 'Mechanical CAD design and detailing, typically at hardware companies', true),
  ('fluid_dynamics',         'engineering', 'CFD and fluid flow analysis, typically at aerospace/energy companies', true),
  ('cad_design',             'engineering', 'CAD modeling and 3D design, typically at hardware/manufacturing companies', true),
  ('fea_analysis',           'engineering', 'Finite element analysis for structural/thermal problems, typically at aerospace/auto companies', true),
  ('mechanism_design',       'engineering', 'Mechanism and linkage design, typically at robotics/consumer hardware companies', true),
  ('packaging_engineering',  'engineering', 'Product packaging and enclosure design, typically at consumer electronics companies', true),
  ('vibration_analysis',     'engineering', 'Vibration and dynamics analysis, typically at aerospace/automotive companies', true),
  ('stress_analysis',        'engineering', 'Structural stress analysis and testing, typically at aerospace companies', true),
  ('kinematics',             'engineering', 'Kinematic analysis for mechanisms and robots, typically at robotics companies', true),
  -- Electrical
  ('analog_design',          'engineering', 'Analog circuit design, typically at semiconductor/hardware companies', true),
  ('digital_design',         'engineering', 'Digital logic design, typically at semiconductor companies', true),
  ('mixed_signal_design',    'engineering', 'Mixed-signal IC and board design, typically at semiconductor companies', true),
  ('motor_control',          'engineering', 'Motor control systems and drives, typically at robotics/EV companies', true),
  ('motor_drives',           'engineering', 'Power electronics for motor drives, typically at industrial/EV companies', true),
  ('battery_engineering',    'engineering', 'Battery system design and BMS, typically at EV/energy storage companies', true),
  ('pcb_design',             'engineering', 'PCB layout and design, typically at hardware companies', true),
  ('schematic_capture',      'engineering', 'Electronic schematic capture and documentation, typically at hardware companies', true),
  ('signal_integrity',       'engineering', 'Signal integrity analysis for high-speed designs, typically at hardware companies', true),
  ('power_systems',          'engineering', 'Power distribution and management systems, typically at aerospace/energy companies', true),
  ('embedded_hardware',      'engineering', 'Embedded hardware design for processor boards, typically at hardware companies', true),
  -- RF / Wireless
  ('antenna_design',         'engineering', 'Antenna design and simulation, typically at wireless/satellite companies', true),
  ('wireless_engineering',   'engineering', 'Wireless communication systems, typically at telecom/IoT companies', true),
  ('microwave_engineering',  'engineering', 'Microwave circuit and system design, typically at defense/satellite companies', true),
  ('communications_engineering','engineering','Communication systems and protocols, typically at telecom companies', true),
  ('radar_engineering',      'engineering', 'Radar system design and signal processing, typically at defense companies', true),
  ('satcom_engineering',     'engineering', 'Satellite communication systems, typically at space/defense companies', true),
  -- FPGA / ASIC / Chip
  ('verification_engineering','engineering','Hardware verification and validation, typically at semiconductor companies', true),
  ('hardware_description_languages','engineering','HDL design (Verilog/VHDL), typically at semiconductor/FPGA companies', true),
  ('soc_design',             'engineering', 'System-on-chip architecture and design, typically at semiconductor companies', true),
  ('dsp_engineering',        'engineering', 'Digital signal processing implementation, typically at semiconductor/defense companies', true),
  ('chip_architecture',      'engineering', 'Chip architecture and microarchitecture, typically at semiconductor companies', true),
  ('physical_design',        'engineering', 'IC physical design and layout, typically at semiconductor companies', true),
  ('chip_verification',      'engineering', 'Chip verification and tape-out, typically at semiconductor companies', true),
  -- Hardware
  ('hardware_design',        'engineering', 'General hardware design and prototyping, typically at hardware startups', true),
  ('prototyping',            'engineering', 'Rapid prototyping and proof-of-concept builds, typically at hardware startups', true),
  ('electromechanical_engineering','engineering','Electromechanical system design, typically at robotics/hardware companies', true),
  ('hardware_integration',   'engineering', 'Hardware system integration and testing, typically at aerospace/defense companies', true),
  -- Aerospace
  ('aerodynamics',           'engineering', 'Aerodynamic design and analysis, typically at aerospace companies', true),
  ('flight_dynamics',        'engineering', 'Flight dynamics modeling and simulation, typically at aerospace companies', true),
  ('aerospace_structures',   'engineering', 'Aerospace structural design and analysis, typically at aerospace companies', true),
  ('mission_systems',        'engineering', 'Mission systems integration, typically at defense/space companies', true),
  ('orbital_mechanics',      'engineering', 'Orbital mechanics and trajectory design, typically at space companies', true),
  ('space_systems',          'engineering', 'Space systems engineering and design, typically at space companies', true),
  -- Systems
  ('systems_architecture',   'engineering', 'Systems architecture across disciplines, typically at complex systems companies', true),
  ('requirements_engineering','engineering','Requirements capture and management, typically at aerospace/defense companies', true),
  ('model_based_systems_engineering','engineering','MBSE with SysML/Cameo, typically at aerospace/defense companies', true),
  ('integration_test',       'engineering', 'System integration and test, typically at aerospace/defense companies', true),
  ('mission_integration',    'engineering', 'Mission-level integration and validation, typically at space companies', true),
  -- Controls
  ('control_systems',        'engineering', 'Control system design and analysis, typically at robotics/aerospace companies', true),
  ('autonomy_engineering',   'engineering', 'Autonomy system architecture, typically at AV/robotics companies', true),
  ('guidance_engineering',   'engineering', 'Guidance system design, typically at aerospace/defense companies', true),
  ('navigation_engineering', 'engineering', 'Navigation system design and integration, typically at aerospace/AV companies', true),
  -- Robotics
  ('robotic_perception',     'engineering', 'Robot perception and computer vision, typically at robotics companies', true),
  ('robotic_manipulation',   'engineering', 'Robotic grasping and manipulation, typically at robotics companies', true),
  ('robotic_navigation',     'engineering', 'Robot navigation and localization, typically at robotics companies', true),
  ('ros_engineering',        'engineering', 'ROS/ROS2 development, typically at robotics companies', true),
  ('robotics_integration',   'engineering', 'Full robot system integration, typically at robotics companies', true),
  ('autonomous_systems_engineering','engineering','Autonomous systems design end-to-end, typically at AV/drone companies', true),
  -- Manufacturing
  ('process_engineering',    'engineering', 'Manufacturing process design and optimization, typically at production companies', true),
  ('automation_engineering', 'engineering', 'Factory automation systems, typically at manufacturing companies', true),
  ('industrial_engineering', 'engineering', 'Industrial engineering and process optimization, typically at manufacturing companies', true),
  ('production_engineering', 'engineering', 'Production line engineering, typically at manufacturing companies', true),
  ('supply_chain_engineering','engineering','Supply chain systems and optimization, typically at hardware companies', true),
  ('assembly_engineering',   'engineering', 'Assembly process design, typically at hardware manufacturing companies', true),
  ('dfm_engineering',        'engineering', 'Design for manufacturability analysis, typically at hardware companies', true),
  ('tooling_engineering',    'engineering', 'Tooling and fixture design, typically at manufacturing companies', true),
  ('fabrication_engineering','engineering', 'Fabrication process engineering, typically at manufacturing companies', true),
  ('machining',              'engineering', 'CNC machining and machine tool programming, typically at manufacturing companies', true),
  -- Test / Reliability / Quality
  ('hardware_in_loop',       'engineering', 'Hardware-in-the-loop test systems, typically at aerospace/auto companies', true),
  ('software_in_loop',       'engineering', 'Software-in-the-loop simulation, typically at aerospace/auto companies', true),
  ('validation_engineering', 'engineering', 'Product validation and verification testing, typically at hardware companies', true),
  ('qualification_engineering','engineering','Qualification testing for standards compliance, typically at aerospace companies', true),
  ('environmental_testing',  'engineering', 'Environmental stress testing (thermal, vibration), typically at aerospace companies', true),
  ('failure_analysis',       'engineering', 'Root cause failure analysis, typically at hardware/semiconductor companies', true),
  ('certification_engineering','engineering','Certification against standards (DO-178, ISO 26262), typically at aerospace/auto companies', true),
  ('ground_test',            'engineering', 'Ground test campaign execution, typically at aerospace companies', true),
  ('flight_test',            'engineering', 'Flight test engineering and data analysis, typically at aerospace companies', true),
  -- Optics / Photonics
  ('photonics_engineering',  'engineering', 'Photonics device and system design, typically at photonics/sensor companies', true),
  ('imaging_systems',        'engineering', 'Imaging system design and integration, typically at camera/sensor companies', true),
  ('laser_engineering',      'engineering', 'Laser system design and applications, typically at photonics/defense companies', true),
  ('optical_design',         'engineering', 'Optical system design with ray tracing, typically at optics/sensor companies', true),
  ('optomechanical_engineering','engineering','Optomechanical mount and packaging design, typically at optics companies', true),
  -- Materials
  ('composites_engineering', 'engineering', 'Composite materials design and manufacturing, typically at aerospace companies', true),
  ('metallurgy',             'engineering', 'Metallurgy and metal alloy engineering, typically at manufacturing companies', true),
  ('polymer_engineering',    'engineering', 'Polymer science and plastics engineering, typically at materials companies', true),
  ('ceramics_engineering',   'engineering', 'Ceramics and advanced materials engineering, typically at materials companies', true),
  ('materials_characterization','engineering','Materials testing and characterization, typically at materials/aerospace companies', true),
  -- Mechatronics
  ('actuator_engineering',   'engineering', 'Actuator design and integration, typically at robotics companies', true),
  ('servo_engineering',      'engineering', 'Servo system design and tuning, typically at robotics/CNC companies', true),
  -- Engineering Leadership
  ('engineering_management', 'engineering', 'Engineering team management, typically at tech companies', true),
  ('technical_program_management','engineering','Technical program management across engineering, typically at tech companies', true),
  ('principal_engineer',     'engineering', 'Principal-level IC engineering leadership, typically at large tech companies', true),
  ('distinguished_engineer', 'engineering', 'Distinguished/fellow-level technical leadership, typically at large tech companies', true),
  ('chief_engineer',         'engineering', 'Chief engineer role overseeing technical direction, typically at aerospace/hardware companies', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Product Manager specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('hardware_pm',            'product', 'Product management for physical hardware products, typically at hardware companies', true),
  ('platform_pm',            'product', 'Platform product management, typically at platform/infra companies', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Designer specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('industrial_design',      'design', 'Industrial design for physical products, typically at consumer hardware companies', true),
  ('hardware_product_design','design', 'Physical product design bridging ID and engineering, typically at hardware companies', true),
  ('mechanical_design_engineering','design','Design engineering combining aesthetics and mechanics, typically at hardware companies', true),
  ('human_factors_engineering','design','Human factors and ergonomics engineering, typically at aerospace/medical companies', true),
  ('interaction_design',     'design', 'Interaction design for digital products, typically at tech companies', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Operator specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('business_operations',    'operations', 'General business operations, typically at startups and growth companies', true),
  ('chief_of_staff',         'operations', 'Chief of staff to CEO/leadership, typically at startups', true),
  ('program_management',     'operations', 'Program management across functions, typically at large companies', true),
  ('strategy_operations',    'operations', 'Strategy and operations planning, typically at growth companies', true),
  ('operations_general',     'operations', 'General operations roles, typically at any company', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Sales / GTM specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('sales_executive',        'sales', 'Sales leadership and closing, typically at B2B companies', true),
  ('account_executive',      'sales', 'Account management and sales execution, typically at SaaS companies', true),
  ('business_development',   'sales', 'Business development and partnerships, typically at growth companies', true),
  ('solutions_engineering',  'sales', 'Solutions engineering for technical sales, typically at B2B tech companies', true),
  ('forward_deployed_engineering','sales','Forward-deployed engineering at customer sites, typically at enterprise tech companies', true),
  ('federal_sales',          'sales', 'Federal government sales, typically at defense/gov tech companies', true),
  ('defense_sales',          'sales', 'Defense industry sales and BD, typically at defense contractors', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Marketing / Growth specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('product_marketing',      'marketing', 'Product marketing and positioning, typically at tech companies', true),
  ('demand_generation',      'marketing', 'Demand generation and lead acquisition, typically at B2B companies', true),
  ('communications',         'marketing', 'Corporate communications and PR, typically at any company', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Recruiter / Talent specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('founding_recruiting',    'recruiting', 'First recruiting hire building the function, typically at early startups', true),
  ('head_of_talent',         'recruiting', 'Head of talent/recruiting leadership, typically at growth-stage companies', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Finance specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('finance_general',        'finance', 'General finance roles, typically at any company', true),
  ('accounting',             'finance', 'Accounting and financial reporting, typically at any company', true),
  ('fpa',                    'finance', 'Financial planning and analysis, typically at growth companies', true),
  ('treasury',               'finance', 'Treasury management, typically at large companies', true),
  ('investor_relations',     'finance', 'Investor relations and fundraising support, typically at public/late-stage companies', true),
  ('corporate_development',  'finance', 'M&A and corporate development, typically at large tech companies', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Legal specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('legal_counsel',          'legal', 'General legal counsel, typically at tech companies', true),
  ('regulatory_affairs',     'legal', 'Regulatory affairs and compliance, typically at aerospace/medical companies', true),
  ('ip_legal',               'legal', 'Intellectual property law, typically at tech/hardware companies', true),
  ('contracts',              'legal', 'Contract negotiation and management, typically at any company', true),
  ('compliance',             'legal', 'Compliance program management, typically at regulated industries', true),
  ('export_compliance',      'legal', 'ITAR/EAR export compliance, typically at defense/aerospace companies', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Founder specialties
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active) VALUES
  ('ceo',                    'founder', 'Chief Executive Officer, typically at startups', true),
  ('founding_engineer',      'founder', 'Founding/first engineer at a company, typically at early startups', true),
  ('co_founder',             'founder', 'Company co-founder, typically at startups', true),
  ('founding_team_member',   'founder', 'Early founding team member, typically at startups', true)
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Ensure parent_function values exist in function_dictionary (some are new)
INSERT INTO function_dictionary (function_normalized, description, active) VALUES
  ('finance', 'Finance and accounting', true),
  ('legal', 'Legal and compliance', true),
  ('founder', 'Founders and founding team', true)
ON CONFLICT (function_normalized) DO NOTHING;


-- ── STEP 4: Populate role_specialty_map ──────────────────────────────────────
-- Maps every specialty to its primary role (and secondary where appropriate).
-- Uses subqueries to resolve role_id by name.

-- Helper: insert a mapping by role name + specialty
-- We'll use a DO block for cleaner syntax.

DO $$
DECLARE
  r_software uuid;
  r_embedded uuid;
  r_hardware uuid;
  r_electrical uuid;
  r_mechanical uuid;
  r_rf uuid;
  r_fpga uuid;
  r_aerospace uuid;
  r_systems uuid;
  r_controls uuid;
  r_robotics uuid;
  r_manufacturing uuid;
  r_test uuid;
  r_optics uuid;
  r_materials uuid;
  r_mechatronics uuid;
  r_eng_lead uuid;
  r_pm uuid;
  r_designer uuid;
  r_operator uuid;
  r_sales uuid;
  r_marketing uuid;
  r_recruiter uuid;
  r_finance uuid;
  r_legal uuid;
  r_founder uuid;
BEGIN
  SELECT role_id INTO r_software FROM role_dictionary WHERE role_name = 'Software Engineer';
  SELECT role_id INTO r_embedded FROM role_dictionary WHERE role_name = 'Embedded / Firmware Engineer';
  SELECT role_id INTO r_hardware FROM role_dictionary WHERE role_name = 'Hardware Engineer';
  SELECT role_id INTO r_electrical FROM role_dictionary WHERE role_name = 'Electrical Engineer';
  SELECT role_id INTO r_mechanical FROM role_dictionary WHERE role_name = 'Mechanical Engineer';
  SELECT role_id INTO r_rf FROM role_dictionary WHERE role_name = 'RF / Wireless Engineer';
  SELECT role_id INTO r_fpga FROM role_dictionary WHERE role_name = 'FPGA / ASIC / Chip Engineer';
  SELECT role_id INTO r_aerospace FROM role_dictionary WHERE role_name = 'Aerospace Engineer';
  SELECT role_id INTO r_systems FROM role_dictionary WHERE role_name = 'Systems Engineer';
  SELECT role_id INTO r_controls FROM role_dictionary WHERE role_name = 'Controls Engineer';
  SELECT role_id INTO r_robotics FROM role_dictionary WHERE role_name = 'Robotics Engineer';
  SELECT role_id INTO r_manufacturing FROM role_dictionary WHERE role_name = 'Manufacturing / Production Engineer';
  SELECT role_id INTO r_test FROM role_dictionary WHERE role_name = 'Test / Reliability / Quality Engineer';
  SELECT role_id INTO r_optics FROM role_dictionary WHERE role_name = 'Optics / Photonics Engineer';
  SELECT role_id INTO r_materials FROM role_dictionary WHERE role_name = 'Materials Engineer';
  SELECT role_id INTO r_mechatronics FROM role_dictionary WHERE role_name = 'Mechatronics Engineer';
  SELECT role_id INTO r_eng_lead FROM role_dictionary WHERE role_name = 'Engineering Leadership';
  SELECT role_id INTO r_pm FROM role_dictionary WHERE role_name = 'Product Manager';
  SELECT role_id INTO r_designer FROM role_dictionary WHERE role_name = 'Designer';
  SELECT role_id INTO r_operator FROM role_dictionary WHERE role_name = 'Operator';
  SELECT role_id INTO r_sales FROM role_dictionary WHERE role_name = 'Sales / GTM';
  SELECT role_id INTO r_marketing FROM role_dictionary WHERE role_name = 'Marketing / Growth';
  SELECT role_id INTO r_recruiter FROM role_dictionary WHERE role_name = 'Recruiter / Talent';
  SELECT role_id INTO r_finance FROM role_dictionary WHERE role_name = 'Finance';
  SELECT role_id INTO r_legal FROM role_dictionary WHERE role_name = 'Legal';
  SELECT role_id INTO r_founder FROM role_dictionary WHERE role_name = 'Founder';

  -- Software Engineer (primary mappings)
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_software, 'backend', true), (r_software, 'frontend', true), (r_software, 'fullstack', true),
    (r_software, 'mobile_ios', true), (r_software, 'mobile_android', true),
    (r_software, 'data_engineering', true), (r_software, 'devops', true), (r_software, 'sre', true),
    (r_software, 'infrastructure', true), (r_software, 'platform', true),
    (r_software, 'ml_engineering', true), (r_software, 'ai_research', true),
    (r_software, 'computer_vision', true), (r_software, 'nlp', true),
    (r_software, 'blockchain', true), (r_software, 'game_engineering', true),
    (r_software, 'security', true), (r_software, 'qa_testing', true), (r_software, 'devrel', true),
    (r_software, 'distributed_systems', true), (r_software, 'simulation_software', true),
    (r_software, 'ground_software', true), (r_software, 'mission_software', true),
    (r_software, 'autonomy_software', true), (r_software, 'perception_software', true),
    (r_software, 'controls_software', true), (r_software, 'robotics_software', true),
    (r_software, 'motion_planning', true), (r_software, 'slam', true), (r_software, 'sensor_fusion', true),
    (r_software, 'ml_infrastructure', true), (r_software, 'ml_ops', true), (r_software, 'applied_ml', true),
    (r_software, 'data_platform', true), (r_software, 'analytics_engineering', true),
    (r_software, 'api_engineering', true), (r_software, 'flight_software', true),
    (r_software, 'low_level_systems', true), (r_software, 'kernel_engineering', true),
    (r_software, 'driver_engineering', true), (r_software, 'bootloader_engineering', true),
    (r_software, 'real_time_systems', true), (r_software, 'rtos_engineering', true),
    (r_software, 'data_analytics', true)
  ON CONFLICT DO NOTHING;

  -- Embedded / Firmware (primary)
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_embedded, 'embedded', true), (r_embedded, 'firmware', true),
    (r_embedded, 'embedded_software', true), (r_embedded, 'rtos_engineering', false),
    (r_embedded, 'bootloader_engineering', false), (r_embedded, 'driver_engineering', false)
  ON CONFLICT DO NOTHING;

  -- Hardware Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_hardware, 'hardware_engineering', true), (r_hardware, 'hardware_design', true),
    (r_hardware, 'prototyping', true), (r_hardware, 'electromechanical_engineering', true),
    (r_hardware, 'hardware_integration', true)
  ON CONFLICT DO NOTHING;

  -- Electrical Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_electrical, 'electrical_engineering', true), (r_electrical, 'analog_design', true),
    (r_electrical, 'digital_design', true), (r_electrical, 'mixed_signal_design', true),
    (r_electrical, 'power_electronics', true), (r_electrical, 'motor_control', true),
    (r_electrical, 'motor_drives', true), (r_electrical, 'battery_engineering', true),
    (r_electrical, 'pcb_design', true), (r_electrical, 'schematic_capture', true),
    (r_electrical, 'signal_integrity', true), (r_electrical, 'power_systems', true),
    (r_electrical, 'embedded_hardware', true)
  ON CONFLICT DO NOTHING;

  -- Mechanical Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_mechanical, 'mechanical_engineering', true), (r_mechanical, 'mechanical_design', true),
    (r_mechanical, 'structural_engineering', true), (r_mechanical, 'thermal_engineering', true),
    (r_mechanical, 'fluid_dynamics', true), (r_mechanical, 'cad_design', true),
    (r_mechanical, 'fea_analysis', true), (r_mechanical, 'mechanism_design', true),
    (r_mechanical, 'packaging_engineering', true), (r_mechanical, 'vibration_analysis', true),
    (r_mechanical, 'stress_analysis', true), (r_mechanical, 'kinematics', true)
  ON CONFLICT DO NOTHING;

  -- RF / Wireless
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_rf, 'rf_engineering', true), (r_rf, 'antenna_design', true),
    (r_rf, 'wireless_engineering', true), (r_rf, 'microwave_engineering', true),
    (r_rf, 'communications_engineering', true), (r_rf, 'radar_engineering', true),
    (r_rf, 'satcom_engineering', true)
  ON CONFLICT DO NOTHING;

  -- FPGA / ASIC / Chip
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_fpga, 'fpga_engineering', true), (r_fpga, 'asic_engineering', true),
    (r_fpga, 'verification_engineering', true), (r_fpga, 'hardware_description_languages', true),
    (r_fpga, 'soc_design', true), (r_fpga, 'dsp_engineering', true),
    (r_fpga, 'chip_architecture', true), (r_fpga, 'physical_design', true),
    (r_fpga, 'chip_verification', true)
  ON CONFLICT DO NOTHING;

  -- Aerospace Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_aerospace, 'avionics', true), (r_aerospace, 'gnc', true), (r_aerospace, 'propulsion', true),
    (r_aerospace, 'aerodynamics', true), (r_aerospace, 'flight_dynamics', true),
    (r_aerospace, 'aerospace_structures', true), (r_aerospace, 'mission_systems', true),
    (r_aerospace, 'orbital_mechanics', true), (r_aerospace, 'space_systems', true)
  ON CONFLICT DO NOTHING;
  -- Cross-role: flight_software secondary to Aerospace
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_aerospace, 'flight_software', false), (r_aerospace, 'mission_software', false),
    (r_aerospace, 'ground_software', false)
  ON CONFLICT DO NOTHING;

  -- Systems Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_systems, 'systems_engineering', true), (r_systems, 'systems_architecture', true),
    (r_systems, 'requirements_engineering', true), (r_systems, 'model_based_systems_engineering', true),
    (r_systems, 'integration_test', true), (r_systems, 'mission_integration', true)
  ON CONFLICT DO NOTHING;

  -- Controls Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_controls, 'controls_engineering', true), (r_controls, 'control_systems', true),
    (r_controls, 'autonomy_engineering', true), (r_controls, 'guidance_engineering', true),
    (r_controls, 'navigation_engineering', true)
  ON CONFLICT DO NOTHING;
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_controls, 'motor_control', false)
  ON CONFLICT DO NOTHING;

  -- Robotics Engineer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_robotics, 'robotics', true), (r_robotics, 'robotic_perception', true),
    (r_robotics, 'robotic_manipulation', true), (r_robotics, 'robotic_navigation', true),
    (r_robotics, 'ros_engineering', true), (r_robotics, 'robotics_integration', true),
    (r_robotics, 'autonomous_systems_engineering', true)
  ON CONFLICT DO NOTHING;
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_robotics, 'robotics_software', false), (r_robotics, 'motion_planning', false),
    (r_robotics, 'slam', false), (r_robotics, 'sensor_fusion', false)
  ON CONFLICT DO NOTHING;

  -- Manufacturing / Production
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_manufacturing, 'manufacturing_engineering', true), (r_manufacturing, 'process_engineering', true),
    (r_manufacturing, 'automation_engineering', true), (r_manufacturing, 'industrial_engineering', true),
    (r_manufacturing, 'production_engineering', true), (r_manufacturing, 'supply_chain_engineering', true),
    (r_manufacturing, 'assembly_engineering', true), (r_manufacturing, 'dfm_engineering', true),
    (r_manufacturing, 'tooling_engineering', true), (r_manufacturing, 'fabrication_engineering', true),
    (r_manufacturing, 'machining', true)
  ON CONFLICT DO NOTHING;

  -- Test / Reliability / Quality
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_test, 'test_engineering', true), (r_test, 'reliability_engineering', true),
    (r_test, 'quality_engineering', true), (r_test, 'hardware_in_loop', true),
    (r_test, 'software_in_loop', true), (r_test, 'validation_engineering', true),
    (r_test, 'qualification_engineering', true), (r_test, 'environmental_testing', true),
    (r_test, 'failure_analysis', true), (r_test, 'certification_engineering', true),
    (r_test, 'ground_test', true), (r_test, 'flight_test', true)
  ON CONFLICT DO NOTHING;

  -- Optics / Photonics
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_optics, 'optics_engineering', true), (r_optics, 'photonics_engineering', true),
    (r_optics, 'imaging_systems', true), (r_optics, 'laser_engineering', true),
    (r_optics, 'optical_design', true), (r_optics, 'optomechanical_engineering', true)
  ON CONFLICT DO NOTHING;

  -- Materials
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_materials, 'materials_engineering', true), (r_materials, 'composites_engineering', true),
    (r_materials, 'metallurgy', true), (r_materials, 'polymer_engineering', true),
    (r_materials, 'ceramics_engineering', true), (r_materials, 'materials_characterization', true)
  ON CONFLICT DO NOTHING;

  -- Mechatronics
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_mechatronics, 'mechatronics', true), (r_mechatronics, 'actuator_engineering', true),
    (r_mechatronics, 'servo_engineering', true)
  ON CONFLICT DO NOTHING;

  -- Engineering Leadership
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_eng_lead, 'engineering_management', true), (r_eng_lead, 'technical_program_management', true),
    (r_eng_lead, 'principal_engineer', true), (r_eng_lead, 'distinguished_engineer', true),
    (r_eng_lead, 'chief_engineer', true)
  ON CONFLICT DO NOTHING;

  -- Product Manager
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_pm, 'core_pm', true), (r_pm, 'technical_pm', true), (r_pm, 'growth_pm', true),
    (r_pm, 'data_pm', true), (r_pm, 'consumer_pm', true), (r_pm, 'enterprise_pm', true),
    (r_pm, 'hardware_pm', true), (r_pm, 'platform_pm', true)
  ON CONFLICT DO NOTHING;

  -- Designer
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_designer, 'ux_design', true), (r_designer, 'ui_design', true),
    (r_designer, 'design', true), (r_designer, 'motion_design', true),
    (r_designer, 'brand_design', true), (r_designer, 'ux_research', true),
    (r_designer, 'design_systems', true), (r_designer, 'industrial_design', true),
    (r_designer, 'hardware_product_design', true), (r_designer, 'mechanical_design_engineering', true),
    (r_designer, 'human_factors_engineering', true), (r_designer, 'interaction_design', true)
  ON CONFLICT DO NOTHING;

  -- Operator
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_operator, 'biz_ops', true), (r_operator, 'rev_ops', true), (r_operator, 'growth', true),
    (r_operator, 'strategy', true), (r_operator, 'finance_ops', true),
    (r_operator, 'business_operations', true), (r_operator, 'chief_of_staff', true),
    (r_operator, 'program_management', true), (r_operator, 'strategy_operations', true),
    (r_operator, 'operations_general', true)
  ON CONFLICT DO NOTHING;

  -- Sales / GTM
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_sales, 'enterprise_sales', true), (r_sales, 'smb_sales', true),
    (r_sales, 'sales_engineering', true), (r_sales, 'partnerships', true),
    (r_sales, 'sales_executive', true), (r_sales, 'account_executive', true),
    (r_sales, 'business_development', true), (r_sales, 'solutions_engineering', true),
    (r_sales, 'forward_deployed_engineering', true), (r_sales, 'federal_sales', true),
    (r_sales, 'defense_sales', true), (r_sales, 'customer_success', true)
  ON CONFLICT DO NOTHING;
  -- Cross-role: forward_deployed_engineering secondary to Software
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_software, 'forward_deployed_engineering', false)
  ON CONFLICT DO NOTHING;

  -- Marketing / Growth
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_marketing, 'growth_marketing', true), (r_marketing, 'content_marketing', true),
    (r_marketing, 'brand_marketing', true), (r_marketing, 'product_marketing', true),
    (r_marketing, 'demand_generation', true), (r_marketing, 'communications', true)
  ON CONFLICT DO NOTHING;

  -- Recruiter / Talent
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_recruiter, 'tech_recruiting', true), (r_recruiter, 'gna_recruiting', true),
    (r_recruiter, 'executive_search', true), (r_recruiter, 'sourcing', true),
    (r_recruiter, 'university_recruiting', true), (r_recruiter, 'people_ops', true),
    (r_recruiter, 'hrbp', true), (r_recruiter, 'comp_benefits', true),
    (r_recruiter, 'talent_ops', true), (r_recruiter, 'founding_recruiting', true),
    (r_recruiter, 'head_of_talent', true)
  ON CONFLICT DO NOTHING;

  -- Finance
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_finance, 'finance_general', true), (r_finance, 'accounting', true),
    (r_finance, 'fpa', true), (r_finance, 'treasury', true),
    (r_finance, 'investor_relations', true), (r_finance, 'corporate_development', true)
  ON CONFLICT DO NOTHING;

  -- Legal
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_legal, 'legal_counsel', true), (r_legal, 'regulatory_affairs', true),
    (r_legal, 'ip_legal', true), (r_legal, 'contracts', true),
    (r_legal, 'compliance', true), (r_legal, 'export_compliance', true)
  ON CONFLICT DO NOTHING;

  -- Founder
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_founder, 'ceo', true), (r_founder, 'founding_engineer', true),
    (r_founder, 'co_founder', true), (r_founder, 'founding_team_member', true)
  ON CONFLICT DO NOTHING;
  -- Cross-role: founding_engineer secondary to Software
  INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary) VALUES
    (r_software, 'founding_engineer', false)
  ON CONFLICT DO NOTHING;

END $$;

-- ── End of migration 017 ────────────────────────────────────────────────────
