-- Migration 021: Seed title_patterns, keyword_signals, technology_signals
-- for all specialties in specialty_dictionary.
--
-- This activates the 3-pass resolver in lib/normalize/specialty.ts.
-- All patterns are lowercase for case-insensitive matching.

-- ============================================================
-- ENGINEERING — Software
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'backend engineer', 'back-end engineer', 'backend developer', 'back-end developer',
    'backend software engineer', 'server engineer', 'server-side engineer',
    'api engineer', 'api developer', 'platform engineer', 'services engineer',
    'backend architect', 'server developer'
  ],
  keyword_signals = ARRAY[
    'backend', 'back-end', 'server-side', 'api development', 'microservices',
    'distributed systems', 'rest api', 'graphql', 'database design', 'api design',
    'service architecture', 'server infrastructure', 'data modeling', 'api gateway',
    'message queue', 'event-driven', 'service mesh'
  ],
  technology_signals = ARRAY[
    'node.js', 'express', 'django', 'flask', 'rails', 'ruby on rails', 'spring boot',
    'spring', 'fastapi', 'postgres', 'postgresql', 'mysql', 'mongodb', 'redis',
    'kafka', 'rabbitmq', 'elasticsearch', 'grpc', 'graphql', 'docker', 'kubernetes',
    'aws lambda', 'dynamodb', 'cassandra', 'sql server', 'go', 'golang', 'rust',
    'java', 'nestjs', 'prisma', 'sequelize', 'typeorm'
  ]
WHERE specialty_normalized = 'backend';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'frontend engineer', 'front-end engineer', 'frontend developer', 'front-end developer',
    'frontend software engineer', 'ui engineer', 'ui developer', 'web developer',
    'web engineer', 'client-side engineer', 'frontend architect'
  ],
  keyword_signals = ARRAY[
    'frontend', 'front-end', 'client-side', 'user interface', 'web application',
    'responsive design', 'single page application', 'spa', 'web performance',
    'browser', 'dom', 'css architecture', 'component library', 'design system',
    'accessibility', 'a11y', 'web standards'
  ],
  technology_signals = ARRAY[
    'react', 'reactjs', 'react.js', 'angular', 'vue', 'vue.js', 'vuejs', 'svelte',
    'next.js', 'nextjs', 'nuxt', 'typescript', 'javascript', 'webpack', 'vite',
    'tailwind', 'tailwindcss', 'css', 'sass', 'less', 'html', 'redux', 'mobx',
    'storybook', 'cypress', 'playwright', 'jest', 'gatsby', 'remix'
  ]
WHERE specialty_normalized = 'frontend';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'fullstack engineer', 'full-stack engineer', 'full stack engineer',
    'fullstack developer', 'full-stack developer', 'full stack developer',
    'fullstack software engineer', 'full-stack software engineer',
    'software engineer', 'software developer', 'application developer',
    'web application engineer'
  ],
  keyword_signals = ARRAY[
    'full-stack', 'fullstack', 'full stack', 'end-to-end', 'frontend and backend',
    'client and server', 'web application development', 'both frontend',
    'across the stack', 'entire stack'
  ],
  technology_signals = ARRAY[
    'react', 'node.js', 'next.js', 'typescript', 'javascript', 'python',
    'ruby on rails', 'django', 'express', 'postgres', 'mongodb', 'redis',
    'docker', 'aws', 'graphql', 'rest', 'html', 'css', 'vue', 'angular'
  ]
WHERE specialty_normalized = 'fullstack';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ios engineer', 'ios developer', 'ios software engineer', 'ios mobile engineer',
    'iphone developer', 'ios application developer', 'swift developer',
    'ios architect', 'mobile engineer - ios', 'ios lead'
  ],
  keyword_signals = ARRAY[
    'ios', 'iphone', 'ipad', 'apple platform', 'app store', 'ios app',
    'mobile ios', 'ios development', 'ios application', 'cocoa touch',
    'ios sdk', 'ios framework'
  ],
  technology_signals = ARRAY[
    'swift', 'swiftui', 'objective-c', 'uikit', 'xcode', 'cocoapods',
    'core data', 'combine', 'ios sdk', 'testflight', 'app store connect',
    'core animation', 'arkit', 'healthkit', 'widgetkit', 'spm'
  ]
WHERE specialty_normalized = 'mobile_ios';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'android engineer', 'android developer', 'android software engineer',
    'android mobile engineer', 'android application developer', 'kotlin developer',
    'mobile engineer - android', 'android architect', 'android lead'
  ],
  keyword_signals = ARRAY[
    'android', 'google play', 'android app', 'android development',
    'mobile android', 'android application', 'android sdk', 'android platform',
    'android framework', 'play store'
  ],
  technology_signals = ARRAY[
    'kotlin', 'android studio', 'jetpack compose', 'android sdk', 'java',
    'gradle', 'room', 'retrofit', 'dagger', 'hilt', 'coroutines',
    'google play', 'firebase', 'android ndk', 'espresso'
  ]
WHERE specialty_normalized = 'mobile_android';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'infrastructure engineer', 'infra engineer', 'devops engineer', 'site reliability engineer',
    'sre', 'platform engineer', 'cloud engineer', 'cloud infrastructure engineer',
    'devops', 'systems engineer', 'production engineer', 'reliability engineer',
    'cloud architect', 'infrastructure architect', 'platform reliability engineer'
  ],
  keyword_signals = ARRAY[
    'infrastructure', 'devops', 'site reliability', 'sre', 'cloud infrastructure',
    'ci/cd', 'deployment pipeline', 'monitoring', 'observability', 'incident response',
    'on-call', 'uptime', 'availability', 'scalability', 'cloud platform',
    'infrastructure as code', 'container orchestration', 'service mesh'
  ],
  technology_signals = ARRAY[
    'kubernetes', 'docker', 'terraform', 'aws', 'gcp', 'azure', 'ansible',
    'jenkins', 'github actions', 'circleci', 'datadog', 'prometheus', 'grafana',
    'nginx', 'linux', 'helm', 'pulumi', 'cloudformation', 'pagerduty',
    'istio', 'envoy', 'consul', 'vault', 'argocd', 'flux'
  ]
WHERE specialty_normalized = 'infrastructure';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'machine learning engineer', 'ml engineer', 'ml software engineer',
    'applied ml engineer', 'machine learning software engineer',
    'ml platform engineer', 'ml infrastructure engineer',
    'ai engineer', 'ai/ml engineer', 'deep learning engineer'
  ],
  keyword_signals = ARRAY[
    'machine learning', 'deep learning', 'ml model', 'neural network',
    'model training', 'model deployment', 'model serving', 'feature engineering',
    'ml pipeline', 'training infrastructure', 'inference', 'ml system',
    'recommendation system', 'ranking model', 'ml ops', 'model optimization'
  ],
  technology_signals = ARRAY[
    'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'hugging face', 'transformers',
    'mlflow', 'kubeflow', 'sagemaker', 'ray', 'spark', 'pandas', 'numpy',
    'cuda', 'tensorrt', 'onnx', 'xgboost', 'lightgbm', 'wandb', 'dvc',
    'airflow', 'feast', 'triton'
  ]
WHERE specialty_normalized = 'ml_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'data engineer', 'data platform engineer', 'data infrastructure engineer',
    'etl engineer', 'data pipeline engineer', 'analytics engineer',
    'data architect', 'big data engineer', 'data warehouse engineer'
  ],
  keyword_signals = ARRAY[
    'data pipeline', 'etl', 'elt', 'data warehouse', 'data lake', 'data platform',
    'data modeling', 'data infrastructure', 'batch processing', 'stream processing',
    'data ingestion', 'data quality', 'data governance', 'data catalog',
    'dimensional modeling', 'data transformation'
  ],
  technology_signals = ARRAY[
    'spark', 'airflow', 'dbt', 'snowflake', 'bigquery', 'redshift', 'databricks',
    'kafka', 'flink', 'presto', 'trino', 'hive', 'delta lake', 'iceberg',
    'fivetran', 'dagster', 'prefect', 'sql', 'python', 'scala',
    'parquet', 'avro', 'glue'
  ]
WHERE specialty_normalized = 'data_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'security engineer', 'application security engineer', 'appsec engineer',
    'cybersecurity engineer', 'information security engineer', 'infosec engineer',
    'security architect', 'cloud security engineer', 'product security engineer',
    'offensive security engineer', 'detection engineer', 'security software engineer'
  ],
  keyword_signals = ARRAY[
    'security', 'appsec', 'infosec', 'cybersecurity', 'vulnerability',
    'penetration testing', 'threat modeling', 'security audit', 'compliance',
    'encryption', 'authentication', 'authorization', 'zero trust',
    'incident response', 'soc', 'security operations', 'devsecops'
  ],
  technology_signals = ARRAY[
    'burp suite', 'owasp', 'nessus', 'splunk', 'crowdstrike', 'snort',
    'wireshark', 'metasploit', 'hashicorp vault', 'okta', 'auth0',
    'siem', 'soar', 'ids', 'ips', 'waf', 'kms', 'pki', 'tls/ssl'
  ]
WHERE specialty_normalized = 'security';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'embedded engineer', 'embedded software engineer', 'embedded systems engineer',
    'firmware engineer', 'embedded developer', 'embedded linux engineer',
    'bsp engineer', 'embedded c developer'
  ],
  keyword_signals = ARRAY[
    'embedded', 'microcontroller', 'mcu', 'bare metal', 'real-time',
    'embedded linux', 'bsp', 'device driver', 'low-level', 'hardware interface',
    'peripheral', 'interrupt', 'register', 'embedded system', 'iot'
  ],
  technology_signals = ARRAY[
    'c', 'c++', 'embedded c', 'rtos', 'freertos', 'zephyr', 'arm',
    'cortex-m', 'stm32', 'esp32', 'arduino', 'raspberry pi', 'linux kernel',
    'yocto', 'buildroot', 'jtag', 'spi', 'i2c', 'uart', 'can bus',
    'gpio', 'dma', 'cmake'
  ]
WHERE specialty_normalized = 'embedded';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ai researcher', 'ml researcher', 'research scientist', 'research engineer',
    'machine learning researcher', 'deep learning researcher',
    'ai research scientist', 'applied research scientist',
    'nlp researcher', 'computer vision researcher'
  ],
  keyword_signals = ARRAY[
    'research', 'published', 'paper', 'novel architecture', 'state-of-the-art',
    'benchmark', 'pretraining', 'fine-tuning', 'large language model', 'llm',
    'generative ai', 'diffusion model', 'reinforcement learning', 'representation learning',
    'natural language processing', 'computer vision', 'arxiv', 'conference'
  ],
  technology_signals = ARRAY[
    'pytorch', 'tensorflow', 'jax', 'cuda', 'transformers', 'hugging face',
    'wandb', 'latex', 'jupyter', 'numpy', 'scipy', 'matplotlib',
    'openai', 'llama', 'bert', 'gpt', 'stable diffusion', 'vae', 'gan'
  ]
WHERE specialty_normalized = 'ai_research';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'data analyst', 'data scientist', 'business intelligence analyst', 'bi analyst',
    'analytics engineer', 'insights analyst', 'product analyst',
    'business analyst', 'quantitative analyst', 'analytics manager'
  ],
  keyword_signals = ARRAY[
    'analytics', 'data analysis', 'business intelligence', 'insights', 'reporting',
    'dashboard', 'metrics', 'kpi', 'a/b testing', 'experimentation',
    'statistical analysis', 'data visualization', 'cohort analysis',
    'funnel analysis', 'user behavior', 'forecasting'
  ],
  technology_signals = ARRAY[
    'sql', 'python', 'r', 'tableau', 'looker', 'mode', 'amplitude',
    'mixpanel', 'segment', 'dbt', 'jupyter', 'pandas', 'numpy',
    'excel', 'power bi', 'google analytics', 'bigquery', 'snowflake',
    'redshift', 'metabase', 'superset', 'statsmodels'
  ]
WHERE specialty_normalized = 'analytics';

-- ============================================================
-- ENGINEERING — Software (Migration 017 additions)
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'embedded software engineer', 'embedded sw engineer', 'embedded application engineer',
    'embedded software developer', 'mcu software engineer'
  ],
  keyword_signals = ARRAY[
    'embedded software', 'microcontroller software', 'mcu programming',
    'hardware abstraction layer', 'hal', 'embedded application',
    'peripheral driver', 'board support package', 'embedded firmware'
  ],
  technology_signals = ARRAY[
    'c', 'c++', 'embedded c', 'arm', 'cortex-m', 'stm32', 'freertos',
    'zephyr', 'threadx', 'keil', 'iar', 'gcc-arm', 'openocd'
  ]
WHERE specialty_normalized = 'embedded_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'real-time systems engineer', 'real-time software engineer',
    'rtos engineer', 'real time systems developer', 'hard real-time engineer'
  ],
  keyword_signals = ARRAY[
    'real-time', 'real time', 'hard real-time', 'deterministic',
    'timing constraint', 'latency-critical', 'safety-critical software',
    'do-178', 'iec 61508', 'iso 26262'
  ],
  technology_signals = ARRAY[
    'vxworks', 'integrity', 'qnx', 'freertos', 'rtems', 'safertos',
    'ada', 'c', 'c++', 'posix', 'preempt_rt'
  ]
WHERE specialty_normalized = 'real_time_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'rtos engineer', 'rtos developer', 'rtos software engineer',
    'rtos integration engineer'
  ],
  keyword_signals = ARRAY[
    'rtos', 'real-time operating system', 'task scheduler', 'priority inversion',
    'mutex', 'semaphore', 'message queue', 'rtos porting', 'rtos bsp'
  ],
  technology_signals = ARRAY[
    'freertos', 'zephyr', 'threadx', 'vxworks', 'qnx', 'rtems',
    'safertos', 'micrium', 'mbed os', 'riot', 'nuttx'
  ]
WHERE specialty_normalized = 'rtos_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'systems programmer', 'low-level systems engineer', 'systems software engineer',
    'os engineer', 'runtime engineer', 'low-level engineer'
  ],
  keyword_signals = ARRAY[
    'low-level', 'systems programming', 'operating system', 'kernel',
    'memory management', 'process scheduling', 'file system', 'syscall',
    'userspace', 'runtime', 'linker', 'loader', 'compiler'
  ],
  technology_signals = ARRAY[
    'c', 'c++', 'rust', 'linux', 'posix', 'gdb', 'llvm', 'gcc',
    'assembly', 'x86', 'arm', 'perf', 'valgrind', 'strace'
  ]
WHERE specialty_normalized = 'low_level_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'kernel engineer', 'kernel developer', 'os kernel engineer',
    'linux kernel engineer', 'kernel software engineer'
  ],
  keyword_signals = ARRAY[
    'kernel', 'kernel module', 'kernel driver', 'linux kernel',
    'scheduler', 'memory management', 'virtual memory', 'page table',
    'system call', 'kernel space', 'kernel patch'
  ],
  technology_signals = ARRAY[
    'linux kernel', 'c', 'git', 'gcc', 'make', 'kconfig', 'gdb',
    'ftrace', 'ebpf', 'bpf', 'perf', 'systemtap', 'dtrace'
  ]
WHERE specialty_normalized = 'kernel_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'driver engineer', 'device driver engineer', 'driver developer',
    'device driver developer', 'driver software engineer'
  ],
  keyword_signals = ARRAY[
    'device driver', 'driver development', 'kernel driver', 'usb driver',
    'pcie driver', 'network driver', 'storage driver', 'display driver',
    'gpu driver', 'hardware abstraction'
  ],
  technology_signals = ARRAY[
    'c', 'linux kernel', 'windows driver', 'wdf', 'wdm', 'ioctl',
    'pcie', 'usb', 'spi', 'i2c', 'dma', 'irq', 'mmio'
  ]
WHERE specialty_normalized = 'driver_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'bootloader engineer', 'bootloader developer', 'boot engineer',
    'firmware boot engineer', 'bios engineer', 'uefi engineer'
  ],
  keyword_signals = ARRAY[
    'bootloader', 'boot sequence', 'u-boot', 'secure boot', 'uefi',
    'bios', 'first-stage boot', 'second-stage boot', 'boot rom',
    'chain of trust', 'boot firmware'
  ],
  technology_signals = ARRAY[
    'u-boot', 'uefi', 'grub', 'arm trusted firmware', 'coreboot',
    'c', 'assembly', 'spl', 'tfa', 'secure boot'
  ]
WHERE specialty_normalized = 'bootloader_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'distributed systems engineer', 'distributed computing engineer',
    'distributed systems architect'
  ],
  keyword_signals = ARRAY[
    'distributed systems', 'distributed computing', 'consensus algorithm',
    'fault tolerance', 'replication', 'sharding', 'partitioning',
    'eventual consistency', 'cap theorem', 'raft', 'paxos',
    'distributed database', 'distributed storage'
  ],
  technology_signals = ARRAY[
    'kafka', 'zookeeper', 'etcd', 'cassandra', 'cockroachdb', 'spanner',
    'dynamodb', 'redis cluster', 'consul', 'grpc', 'protobuf',
    'kubernetes', 'raft', 'rocksdb', 'foundationdb'
  ]
WHERE specialty_normalized = 'distributed_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'simulation engineer', 'simulation software engineer', 'modeling and simulation engineer',
    'physics simulation engineer', 'numerical simulation engineer'
  ],
  keyword_signals = ARRAY[
    'simulation', 'modeling and simulation', 'physics simulation',
    'numerical methods', 'finite element', 'computational fluid dynamics',
    'monte carlo', 'digital twin', 'sim environment', 'hardware-in-the-loop'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'ansys', 'comsol', 'abaqus', 'openfoam',
    'python', 'c++', 'fortran', 'julia', 'nastran', 'star-ccm+'
  ]
WHERE specialty_normalized = 'simulation_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ground software engineer', 'ground systems engineer', 'ground control engineer',
    'mission operations software engineer', 'ground station engineer'
  ],
  keyword_signals = ARRAY[
    'ground software', 'ground control', 'ground station', 'mission operations',
    'telemetry', 'command and control', 'ground segment', 'mission control',
    'spacecraft operations', 'satellite operations'
  ],
  technology_signals = ARRAY[
    'python', 'c++', 'java', 'ccsds', 'tmtc', 'cosmos', 'openc3',
    'grafana', 'influxdb', 'protobuf', 'grpc', 'postgresql'
  ]
WHERE specialty_normalized = 'ground_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mission software engineer', 'mission-critical software engineer',
    'flight software engineer', 'vehicle software engineer',
    'safety-critical software engineer'
  ],
  keyword_signals = ARRAY[
    'mission-critical', 'safety-critical', 'flight software', 'vehicle software',
    'avionics software', 'do-178', 'mission assurance', 'fault management',
    'redundancy', 'watchdog', 'health monitoring'
  ],
  technology_signals = ARRAY[
    'c', 'c++', 'ada', 'rtems', 'vxworks', 'do-178b', 'do-178c',
    'misra c', 'static analysis', 'ldra', 'polyspace', 'coverity'
  ]
WHERE specialty_normalized = 'mission_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'autonomy engineer', 'autonomy software engineer', 'autonomous systems engineer',
    'self-driving engineer', 'autonomous vehicle engineer', 'av engineer'
  ],
  keyword_signals = ARRAY[
    'autonomy', 'autonomous', 'self-driving', 'autonomous vehicle',
    'decision making', 'behavior planning', 'mission planning',
    'autonomous navigation', 'autonomous system', 'vehicle autonomy'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'c++', 'python', 'autoware', 'apollo', 'carla',
    'gazebo', 'simulink', 'protobuf', 'dds', 'lidar', 'radar'
  ]
WHERE specialty_normalized = 'autonomy_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'perception engineer', 'perception software engineer', 'computer vision engineer',
    'cv engineer', 'visual perception engineer', 'lidar perception engineer',
    'sensor perception engineer'
  ],
  keyword_signals = ARRAY[
    'perception', 'computer vision', 'object detection', 'semantic segmentation',
    'point cloud', 'lidar processing', 'camera pipeline', 'depth estimation',
    '3d reconstruction', 'visual odometry', 'image processing', 'detection model'
  ],
  technology_signals = ARRAY[
    'opencv', 'pytorch', 'tensorflow', 'tensorrt', 'cuda', 'onnx',
    'ros', 'pcl', 'open3d', 'yolo', 'detectron2', 'mmdetection',
    'lidar', 'camera calibration', 'c++', 'python'
  ]
WHERE specialty_normalized = 'perception_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'controls software engineer', 'control systems software engineer',
    'controls engineer - software', 'software controls engineer'
  ],
  keyword_signals = ARRAY[
    'controls software', 'control algorithm', 'pid controller',
    'state estimation', 'kalman filter', 'model predictive control',
    'control loop', 'feedback control', 'control system implementation'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'c', 'c++', 'python', 'ros', 'ros2',
    'autocode', 'embedded coder', 'stateflow', 'pid'
  ]
WHERE specialty_normalized = 'controls_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'robotics software engineer', 'robotics engineer', 'robot software engineer',
    'robotics developer', 'robotics integration engineer'
  ],
  keyword_signals = ARRAY[
    'robotics', 'robot software', 'robot control', 'robot arm',
    'end effector', 'robot integration', 'robot programming',
    'mobile robot', 'humanoid', 'legged robot'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'gazebo', 'moveit', 'rviz', 'c++', 'python',
    'urdf', 'tf', 'navigation2', 'microros', 'isaac sim'
  ]
WHERE specialty_normalized = 'robotics_software';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'motion planning engineer', 'path planning engineer',
    'trajectory planning engineer', 'motion planner'
  ],
  keyword_signals = ARRAY[
    'motion planning', 'path planning', 'trajectory planning', 'trajectory optimization',
    'collision avoidance', 'obstacle avoidance', 'rrt', 'a*', 'dijkstra',
    'motion primitive', 'lattice planner', 'waypoint'
  ],
  technology_signals = ARRAY[
    'c++', 'python', 'ros', 'ros2', 'moveit', 'ompl', 'drake',
    'casadi', 'ipopt', 'eigen', 'fcl', 'bullet'
  ]
WHERE specialty_normalized = 'motion_planning';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'slam engineer', 'localization engineer', 'mapping engineer',
    'slam software engineer', 'visual slam engineer'
  ],
  keyword_signals = ARRAY[
    'slam', 'simultaneous localization and mapping', 'visual slam', 'lidar slam',
    'loop closure', 'pose graph', 'map building', 'localization',
    'place recognition', 'occupancy grid', 'voxel map'
  ],
  technology_signals = ARRAY[
    'c++', 'python', 'ros', 'ros2', 'gtsam', 'g2o', 'ceres',
    'orb-slam', 'cartographer', 'rtab-map', 'opencv', 'eigen',
    'lidar', 'imu', 'point cloud'
  ]
WHERE specialty_normalized = 'slam';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'sensor fusion engineer', 'state estimation engineer',
    'sensor integration engineer', 'multi-sensor fusion engineer'
  ],
  keyword_signals = ARRAY[
    'sensor fusion', 'multi-sensor', 'state estimation', 'kalman filter',
    'extended kalman filter', 'unscented kalman filter', 'particle filter',
    'imu fusion', 'lidar-camera fusion', 'data fusion', 'inertial navigation'
  ],
  technology_signals = ARRAY[
    'c++', 'python', 'matlab', 'ros', 'ros2', 'eigen', 'ceres',
    'gtsam', 'imu', 'lidar', 'gps', 'ins', 'ahrs'
  ]
WHERE specialty_normalized = 'sensor_fusion';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ml infrastructure engineer', 'ml infra engineer', 'ml platform engineer',
    'machine learning infrastructure engineer', 'ai infrastructure engineer'
  ],
  keyword_signals = ARRAY[
    'ml infrastructure', 'ml platform', 'training infrastructure',
    'gpu cluster', 'model serving', 'feature store', 'ml pipeline',
    'training pipeline', 'inference infrastructure', 'model registry'
  ],
  technology_signals = ARRAY[
    'kubernetes', 'docker', 'ray', 'horovod', 'kubeflow', 'mlflow',
    'sagemaker', 'vertex ai', 'triton', 'nvidia', 'cuda', 'gpu',
    'python', 'go', 'terraform', 'airflow'
  ]
WHERE specialty_normalized = 'ml_infrastructure';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mlops engineer', 'ml ops engineer', 'machine learning operations engineer',
    'ml devops engineer', 'aiops engineer'
  ],
  keyword_signals = ARRAY[
    'mlops', 'ml ops', 'model deployment', 'model monitoring', 'model versioning',
    'experiment tracking', 'model lifecycle', 'ml ci/cd', 'model drift',
    'feature engineering pipeline', 'model retraining'
  ],
  technology_signals = ARRAY[
    'mlflow', 'kubeflow', 'wandb', 'dvc', 'bentoml', 'seldon', 'kserve',
    'feast', 'tecton', 'airflow', 'dagster', 'docker', 'kubernetes',
    'sagemaker', 'vertex ai', 'github actions'
  ]
WHERE specialty_normalized = 'ml_ops';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'applied ml engineer', 'applied machine learning engineer',
    'applied ai engineer', 'applied scientist', 'ml product engineer'
  ],
  keyword_signals = ARRAY[
    'applied ml', 'applied machine learning', 'product ml',
    'recommendation', 'ranking', 'search relevance', 'personalization',
    'fraud detection', 'anomaly detection', 'nlp application',
    'text classification', 'named entity recognition'
  ],
  technology_signals = ARRAY[
    'python', 'pytorch', 'tensorflow', 'scikit-learn', 'xgboost',
    'lightgbm', 'spark', 'sql', 'pandas', 'numpy', 'hugging face',
    'fastapi', 'redis', 'elasticsearch'
  ]
WHERE specialty_normalized = 'applied_ml';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'data platform engineer', 'data platform architect',
    'data warehouse engineer', 'data lakehouse engineer'
  ],
  keyword_signals = ARRAY[
    'data platform', 'data warehouse', 'data lakehouse', 'data lake',
    'data mesh', 'data catalog', 'metadata management',
    'data discovery', 'self-serve data', 'data marketplace'
  ],
  technology_signals = ARRAY[
    'snowflake', 'bigquery', 'redshift', 'databricks', 'delta lake',
    'iceberg', 'hudi', 'spark', 'dbt', 'airflow', 'kafka',
    'hive metastore', 'glue catalog', 'unity catalog'
  ]
WHERE specialty_normalized = 'data_platform';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'analytics engineer', 'analytics engineering lead',
    'senior analytics engineer', 'staff analytics engineer'
  ],
  keyword_signals = ARRAY[
    'analytics engineering', 'data modeling', 'dimensional modeling',
    'data transformation', 'data testing', 'metrics layer',
    'semantic layer', 'data documentation', 'data quality'
  ],
  technology_signals = ARRAY[
    'dbt', 'sql', 'snowflake', 'bigquery', 'redshift', 'looker',
    'mode', 'sigma', 'fivetran', 'stitch', 'airbyte', 'python',
    'jinja', 'git', 'yaml'
  ]
WHERE specialty_normalized = 'analytics_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'api engineer', 'api developer', 'api platform engineer',
    'api architect', 'api integration engineer'
  ],
  keyword_signals = ARRAY[
    'api design', 'api development', 'api platform', 'api gateway',
    'api management', 'openapi', 'swagger', 'api versioning',
    'api security', 'developer experience', 'developer platform'
  ],
  technology_signals = ARRAY[
    'rest', 'graphql', 'grpc', 'openapi', 'swagger', 'postman',
    'kong', 'apigee', 'aws api gateway', 'fastapi', 'express',
    'node.js', 'go', 'protobuf', 'json schema'
  ]
WHERE specialty_normalized = 'api_engineering';

-- ============================================================
-- ENGINEERING — Mechanical
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mechanical engineer', 'mech engineer', 'mechanical design engineer',
    'product mechanical engineer', 'senior mechanical engineer'
  ],
  keyword_signals = ARRAY[
    'mechanical engineering', 'mechanical design', 'structural analysis',
    'thermal analysis', 'tolerance analysis', 'gd&t', 'mechanisms',
    'sheet metal', 'injection molding', 'cnc machining', 'prototyping'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'nx', 'creo', 'inventor', 'fusion 360',
    'ansys', 'abaqus', 'nastran', 'matlab', 'fea', 'cfd',
    '3d printing', 'gd&t', 'autocad'
  ]
WHERE specialty_normalized = 'mechanical_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mechanical designer', 'cad designer', 'mechanical design engineer',
    'design engineer - mechanical', 'product design engineer'
  ],
  keyword_signals = ARRAY[
    'mechanical design', 'cad design', 'detailed design', 'assembly design',
    'part design', 'drawing creation', 'bill of materials', 'bom',
    'design for assembly', 'tolerance stack-up'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'nx', 'creo', 'inventor', 'fusion 360',
    'autocad', 'solidedge', 'onshape', 'pdm', 'plm'
  ]
WHERE specialty_normalized = 'mechanical_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'cfd engineer', 'fluids engineer', 'fluid dynamics engineer',
    'aerodynamics engineer', 'thermal fluids engineer'
  ],
  keyword_signals = ARRAY[
    'fluid dynamics', 'computational fluid dynamics', 'cfd',
    'flow analysis', 'turbulence', 'heat transfer', 'convection',
    'navier-stokes', 'fluid simulation', 'aerodynamic'
  ],
  technology_signals = ARRAY[
    'ansys fluent', 'openfoam', 'star-ccm+', 'comsol', 'matlab',
    'python', 'paraview', 'tecplot', 'pointwise', 'gambit'
  ]
WHERE specialty_normalized = 'fluid_dynamics';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'cad engineer', 'cad designer', 'cad modeler', '3d modeler',
    'cad technician', 'cad design engineer'
  ],
  keyword_signals = ARRAY[
    'cad', 'computer-aided design', '3d modeling', 'solid modeling',
    'surface modeling', 'parametric design', 'cad model', 'drawing',
    'assembly model', 'part modeling'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'nx', 'creo', 'inventor', 'fusion 360',
    'onshape', 'autocad', 'rhino', 'solidedge', 'freecad'
  ]
WHERE specialty_normalized = 'cad_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'fea engineer', 'structural analyst', 'stress engineer',
    'finite element analyst', 'structural analysis engineer',
    'fea analyst', 'simulation analyst'
  ],
  keyword_signals = ARRAY[
    'finite element', 'fea', 'fem', 'structural analysis', 'stress analysis',
    'modal analysis', 'fatigue analysis', 'buckling', 'nonlinear analysis',
    'mesh generation', 'convergence study'
  ],
  technology_signals = ARRAY[
    'ansys', 'abaqus', 'nastran', 'hypermesh', 'ls-dyna', 'comsol',
    'femap', 'patran', 'matlab', 'python', 'optistruct'
  ]
WHERE specialty_normalized = 'fea_analysis';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mechanism design engineer', 'linkage engineer', 'mechanism engineer',
    'kinematic design engineer'
  ],
  keyword_signals = ARRAY[
    'mechanism design', 'linkage', 'cam', 'gear', 'actuator mechanism',
    'deployment mechanism', 'latch', 'hinge', 'spring mechanism',
    'kinematic chain', 'degree of freedom'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'adams', 'matlab', 'creo mechanism',
    'simpack', 'recurdyn', 'python'
  ]
WHERE specialty_normalized = 'mechanism_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'packaging engineer', 'enclosure engineer', 'product packaging engineer',
    'mechanical packaging engineer', 'housing engineer'
  ],
  keyword_signals = ARRAY[
    'packaging', 'enclosure', 'housing design', 'ip rating', 'sealing',
    'thermal management', 'form factor', 'industrial design engineering',
    'cosmetic requirements', 'drop test'
  ],
  technology_signals = ARRAY[
    'solidworks', 'creo', 'nx', 'keyshot', '3d printing', 'injection molding',
    'sheet metal', 'die casting', 'cnc'
  ]
WHERE specialty_normalized = 'packaging_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'vibration engineer', 'dynamics engineer', 'nvh engineer',
    'structural dynamics engineer', 'vibration analyst'
  ],
  keyword_signals = ARRAY[
    'vibration', 'dynamics', 'nvh', 'modal analysis', 'random vibration',
    'shock', 'fatigue', 'harmonic analysis', 'frequency response',
    'damping', 'vibration isolation', 'natural frequency'
  ],
  technology_signals = ARRAY[
    'ansys', 'nastran', 'matlab', 'labview', 'python',
    'accelerometer', 'fft', 'psd', 'abaqus', 'simcenter'
  ]
WHERE specialty_normalized = 'vibration_analysis';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'stress engineer', 'stress analyst', 'structural stress engineer',
    'loads and stress engineer', 'structural integrity engineer'
  ],
  keyword_signals = ARRAY[
    'stress analysis', 'loads analysis', 'structural integrity',
    'fatigue life', 'damage tolerance', 'fracture mechanics',
    'margin of safety', 'factor of safety', 'static loads',
    'dynamic loads', 'pressure vessel'
  ],
  technology_signals = ARRAY[
    'nastran', 'ansys', 'abaqus', 'femap', 'patran', 'hypermesh',
    'matlab', 'python', 'excel', 'catia', 'isight'
  ]
WHERE specialty_normalized = 'stress_analysis';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'kinematics engineer', 'kinematic analyst', 'motion analysis engineer'
  ],
  keyword_signals = ARRAY[
    'kinematics', 'kinematic analysis', 'forward kinematics', 'inverse kinematics',
    'motion analysis', 'trajectory', 'workspace analysis', 'jacobian',
    'robot kinematics', 'articulated mechanism'
  ],
  technology_signals = ARRAY[
    'matlab', 'python', 'adams', 'ros', 'solidworks motion',
    'simscape', 'drake', 'pinocchio'
  ]
WHERE specialty_normalized = 'kinematics';

-- ============================================================
-- ENGINEERING — Electrical
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'electrical engineer', 'ee', 'hardware electrical engineer',
    'electronics engineer', 'electrical design engineer'
  ],
  keyword_signals = ARRAY[
    'electrical engineering', 'circuit design', 'pcb', 'schematic',
    'power supply', 'analog', 'digital', 'mixed signal', 'electronics',
    'voltage regulator', 'power distribution', 'harness'
  ],
  technology_signals = ARRAY[
    'altium', 'cadence', 'orcad', 'eagle', 'kicad', 'pads',
    'ltspice', 'spice', 'oscilloscope', 'logic analyzer', 'multimeter',
    'matlab', 'python', 'vhdl', 'verilog'
  ]
WHERE specialty_normalized = 'electrical_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'analog design engineer', 'analog ic designer', 'analog circuit designer',
    'analog engineer', 'mixed-signal ic designer'
  ],
  keyword_signals = ARRAY[
    'analog design', 'analog circuit', 'op-amp', 'amplifier',
    'adc', 'dac', 'pll', 'voltage reference', 'bandgap',
    'bias circuit', 'low noise', 'high speed analog'
  ],
  technology_signals = ARRAY[
    'cadence virtuoso', 'hspice', 'spectre', 'ltspice', 'ads',
    'calibre', 'assura', 'matlab', 'python', 'cmos', 'bicmos'
  ]
WHERE specialty_normalized = 'analog_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'digital design engineer', 'digital ic designer', 'rtl designer',
    'digital logic engineer', 'logic designer'
  ],
  keyword_signals = ARRAY[
    'digital design', 'rtl', 'logic design', 'synthesis', 'timing closure',
    'clock domain crossing', 'cdc', 'pipeline', 'fsm', 'state machine',
    'digital logic', 'gate-level', 'netlist'
  ],
  technology_signals = ARRAY[
    'verilog', 'systemverilog', 'vhdl', 'synopsys', 'cadence',
    'design compiler', 'primetime', 'vivado', 'quartus', 'modelsim',
    'verilator', 'yosys'
  ]
WHERE specialty_normalized = 'digital_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mixed signal design engineer', 'mixed-signal engineer',
    'mixed signal ic designer', 'data converter engineer'
  ],
  keyword_signals = ARRAY[
    'mixed signal', 'mixed-signal', 'adc', 'dac', 'data converter',
    'analog-digital interface', 'sampling', 'quantization',
    'signal conditioning', 'anti-aliasing'
  ],
  technology_signals = ARRAY[
    'cadence virtuoso', 'hspice', 'spectre', 'verilog-ams',
    'verilog', 'systemverilog', 'matlab', 'calibre', 'assura'
  ]
WHERE specialty_normalized = 'mixed_signal_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'motor control engineer', 'motor controls engineer',
    'motor drive engineer', 'electric drive engineer'
  ],
  keyword_signals = ARRAY[
    'motor control', 'bldc', 'pmsm', 'induction motor', 'field oriented control',
    'foc', 'torque control', 'speed control', 'commutation',
    'motor drive', 'servo control', 'back-emf'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'c', 'c++', 'ti c2000', 'stm32',
    'microchip', 'plecs', 'ltspice', 'can bus', 'modbus'
  ]
WHERE specialty_normalized = 'motor_control';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'motor drives engineer', 'power drive engineer', 'drive systems engineer',
    'power electronics drive engineer'
  ],
  keyword_signals = ARRAY[
    'motor drives', 'power drive', 'inverter', 'converter', 'rectifier',
    'pwm', 'gate driver', 'power stage', 'dc-dc', 'ac-dc',
    'igbt', 'mosfet', 'sic', 'gan'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'plecs', 'ltspice', 'altium', 'c',
    'ti c2000', 'infineon', 'silicon carbide', 'gallium nitride'
  ]
WHERE specialty_normalized = 'motor_drives';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'battery engineer', 'battery systems engineer', 'bms engineer',
    'energy storage engineer', 'battery management engineer',
    'battery pack engineer', 'cell engineer'
  ],
  keyword_signals = ARRAY[
    'battery', 'battery management system', 'bms', 'cell balancing',
    'state of charge', 'state of health', 'battery pack', 'thermal management',
    'lithium ion', 'lithium polymer', 'energy storage', 'cell characterization'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'python', 'altium', 'can bus', 'c',
    'labview', 'neware', 'arbin', 'comsol', 'star-ccm+'
  ]
WHERE specialty_normalized = 'battery_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'pcb designer', 'pcb layout engineer', 'pcb engineer',
    'board designer', 'pcb design engineer', 'layout engineer'
  ],
  keyword_signals = ARRAY[
    'pcb', 'printed circuit board', 'board layout', 'pcb layout',
    'routing', 'stackup', 'impedance control', 'copper pour',
    'design rule check', 'gerber', 'fabrication drawing'
  ],
  technology_signals = ARRAY[
    'altium', 'cadence allegro', 'orcad', 'eagle', 'kicad', 'pads',
    'mentor graphics', 'zuken', 'hyperlynx', 'si', 'pi'
  ]
WHERE specialty_normalized = 'pcb_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'schematic capture engineer', 'schematic designer',
    'electronics design engineer', 'circuit designer'
  ],
  keyword_signals = ARRAY[
    'schematic capture', 'schematic design', 'circuit design',
    'component selection', 'bill of materials', 'bom management',
    'design review', 'circuit simulation', 'part library'
  ],
  technology_signals = ARRAY[
    'altium', 'orcad', 'cadence', 'eagle', 'kicad', 'ltspice',
    'pspice', 'multisim', 'pads'
  ]
WHERE specialty_normalized = 'schematic_capture';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'signal integrity engineer', 'si engineer', 'si/pi engineer',
    'high-speed design engineer', 'signal integrity analyst'
  ],
  keyword_signals = ARRAY[
    'signal integrity', 'si', 'high-speed design', 'impedance matching',
    'crosstalk', 'jitter', 'eye diagram', 'return loss', 'insertion loss',
    'transmission line', 'power integrity', 'pi', 'emc', 'emi'
  ],
  technology_signals = ARRAY[
    'hyperlynx', 'hfss', 'cst', 'ads', 'sigrity', 'simbeor',
    'ansys', 'oscilloscope', 'tdr', 'vna', 'matlab'
  ]
WHERE specialty_normalized = 'signal_integrity';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'power systems engineer', 'power engineer', 'power distribution engineer',
    'power management engineer', 'electrical power engineer'
  ],
  keyword_signals = ARRAY[
    'power systems', 'power distribution', 'power management', 'power budget',
    'power supply design', 'dc-dc converter', 'voltage regulation',
    'ups', 'solar', 'grid', 'electrical power'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'etap', 'psse', 'ltspice', 'plecs',
    'altium', 'python', 'labview', 'scada'
  ]
WHERE specialty_normalized = 'power_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'embedded hardware engineer', 'embedded systems hardware engineer',
    'processor board engineer', 'embedded board engineer'
  ],
  keyword_signals = ARRAY[
    'embedded hardware', 'processor board', 'som', 'system on module',
    'carrier board', 'compute module', 'embedded platform',
    'bsp development', 'boot sequence', 'hardware-software interface'
  ],
  technology_signals = ARRAY[
    'altium', 'orcad', 'arm', 'x86', 'fpga', 'ddr', 'pcie',
    'usb', 'ethernet', 'spi', 'i2c', 'jtag', 'oscilloscope'
  ]
WHERE specialty_normalized = 'embedded_hardware';

-- ============================================================
-- ENGINEERING — RF/Wireless
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'rf engineer', 'radio frequency engineer', 'rf design engineer',
    'rf systems engineer', 'rf hardware engineer'
  ],
  keyword_signals = ARRAY[
    'rf', 'radio frequency', 'rf design', 'rf circuit', 'rf system',
    'transmitter', 'receiver', 'transceiver', 'rf front end',
    'rf filter', 'amplifier', 'mixer', 'oscillator'
  ],
  technology_signals = ARRAY[
    'ads', 'hfss', 'cst', 'cadence', 'matlab', 'keysight',
    'spectrum analyzer', 'network analyzer', 'vna', 'signal generator',
    'ltspice', 'sonnet', 'momentum'
  ]
WHERE specialty_normalized = 'rf_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'antenna engineer', 'antenna designer', 'antenna design engineer',
    'antenna systems engineer', 'em engineer'
  ],
  keyword_signals = ARRAY[
    'antenna', 'antenna design', 'phased array', 'beamforming',
    'radiation pattern', 'gain', 'vswr', 'bandwidth', 'polarization',
    'patch antenna', 'horn antenna', 'dipole', 'array antenna'
  ],
  technology_signals = ARRAY[
    'hfss', 'cst', 'feko', 'ads', 'matlab', 'ie3d',
    'antenna measurement', 'anechoic chamber', 'near-field scanner'
  ]
WHERE specialty_normalized = 'antenna_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'wireless engineer', 'wireless systems engineer', 'wireless communication engineer',
    'wireless protocol engineer', 'connectivity engineer'
  ],
  keyword_signals = ARRAY[
    'wireless', 'wifi', 'bluetooth', 'ble', 'zigbee', 'lora',
    'cellular', '5g', 'lte', 'wireless protocol', 'wireless communication',
    'iot connectivity', 'mesh network', 'wireless standard'
  ],
  technology_signals = ARRAY[
    'bluetooth', 'ble', 'wifi', '802.11', 'zigbee', 'thread',
    'matter', 'lora', 'lorawan', 'lte', '5g nr', 'qualcomm',
    'nordic semiconductor', 'esp32', 'ti cc2640'
  ]
WHERE specialty_normalized = 'wireless_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'microwave engineer', 'microwave design engineer', 'rf/microwave engineer',
    'millimeter wave engineer', 'mmwave engineer'
  ],
  keyword_signals = ARRAY[
    'microwave', 'millimeter wave', 'mmwave', 'waveguide', 'stripline',
    'microstrip', 'coupler', 'power divider', 'filter design',
    'high frequency', 'ghz', 'ka-band', 'ku-band'
  ],
  technology_signals = ARRAY[
    'hfss', 'cst', 'ads', 'sonnet', 'cadence', 'momentum',
    'matlab', 'vna', 'spectrum analyzer', 'microwave office'
  ]
WHERE specialty_normalized = 'microwave_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'communications engineer', 'communication systems engineer',
    'telecom engineer', 'telecommunications engineer',
    'wireless communications engineer', 'dsp engineer'
  ],
  keyword_signals = ARRAY[
    'communications', 'communication systems', 'modulation', 'demodulation',
    'signal processing', 'coding', 'decoding', 'ofdm', 'mimo',
    'channel estimation', 'error correction', 'fec', 'phy layer'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'python', 'c', 'c++', 'gnuradio',
    'labview', 'vhdl', 'verilog', 'fpga', 'sdr'
  ]
WHERE specialty_normalized = 'communications_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'radar engineer', 'radar systems engineer', 'radar signal processing engineer',
    'radar design engineer'
  ],
  keyword_signals = ARRAY[
    'radar', 'radar signal processing', 'sar', 'synthetic aperture',
    'doppler', 'target detection', 'tracking', 'waveform design',
    'pulse compression', 'cfar', 'beam steering', 'phased array radar'
  ],
  technology_signals = ARRAY[
    'matlab', 'python', 'c++', 'fpga', 'vhdl', 'verilog',
    'hfss', 'cst', 'labview', 'gpu', 'cuda'
  ]
WHERE specialty_normalized = 'radar_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'satcom engineer', 'satellite communications engineer',
    'satellite systems engineer', 'space communications engineer'
  ],
  keyword_signals = ARRAY[
    'satellite communications', 'satcom', 'link budget', 'ground terminal',
    'transponder', 'orbit determination', 'spacecraft communication',
    'leo constellation', 'geo satellite', 'inter-satellite link'
  ],
  technology_signals = ARRAY[
    'matlab', 'stk', 'python', 'c++', 'fpga', 'sdr',
    'hfss', 'ads', 'vna', 'spectrum analyzer'
  ]
WHERE specialty_normalized = 'satcom_engineering';

-- ============================================================
-- ENGINEERING — FPGA/ASIC/Chip
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'fpga engineer', 'fpga designer', 'fpga developer',
    'fpga design engineer', 'fpga firmware engineer'
  ],
  keyword_signals = ARRAY[
    'fpga', 'field programmable gate array', 'rtl', 'hdl',
    'synthesis', 'place and route', 'timing closure', 'fpga prototyping',
    'ip core', 'fpga verification'
  ],
  technology_signals = ARRAY[
    'vhdl', 'verilog', 'systemverilog', 'vivado', 'quartus', 'xilinx',
    'altera', 'intel fpga', 'lattice', 'zynq', 'modelsim',
    'questasim', 'ila', 'chipscope'
  ]
WHERE specialty_normalized = 'fpga_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'asic engineer', 'asic designer', 'asic design engineer',
    'chip designer', 'ic designer', 'integrated circuit designer'
  ],
  keyword_signals = ARRAY[
    'asic', 'integrated circuit', 'ic design', 'chip design',
    'tape-out', 'tapeout', 'standard cell', 'ip block',
    'silicon', 'process node', 'foundry'
  ],
  technology_signals = ARRAY[
    'verilog', 'systemverilog', 'vhdl', 'synopsys', 'cadence',
    'design compiler', 'icc2', 'innovus', 'calibre', 'virtuoso',
    'primetime', 'formality', 'genus'
  ]
WHERE specialty_normalized = 'asic_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'verification engineer', 'design verification engineer', 'dv engineer',
    'functional verification engineer', 'asic verification engineer',
    'ic verification engineer'
  ],
  keyword_signals = ARRAY[
    'verification', 'design verification', 'functional verification',
    'uvm', 'testbench', 'coverage', 'assertion', 'formal verification',
    'constrained random', 'regression', 'bug hunting'
  ],
  technology_signals = ARRAY[
    'systemverilog', 'uvm', 'vcs', 'questasim', 'modelsim', 'xcelium',
    'jasper', 'jaspergold', 'synopsys', 'cadence', 'mentor',
    'python', 'perl', 'tcl'
  ]
WHERE specialty_normalized = 'verification_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hdl engineer', 'rtl engineer', 'verilog engineer', 'vhdl engineer',
    'digital design engineer'
  ],
  keyword_signals = ARRAY[
    'hdl', 'hardware description language', 'rtl coding', 'verilog',
    'vhdl', 'systemverilog', 'rtl design', 'digital logic',
    'synthesizable code', 'coding guidelines'
  ],
  technology_signals = ARRAY[
    'verilog', 'systemverilog', 'vhdl', 'chisel', 'spinalhdl',
    'bluespec', 'vivado', 'quartus', 'modelsim', 'verilator'
  ]
WHERE specialty_normalized = 'hardware_description_languages';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'soc engineer', 'soc architect', 'soc design engineer',
    'system on chip engineer', 'soc integration engineer'
  ],
  keyword_signals = ARRAY[
    'soc', 'system on chip', 'soc architecture', 'bus architecture',
    'axi', 'ahb', 'apb', 'noc', 'interconnect', 'ip integration',
    'memory subsystem', 'soc verification'
  ],
  technology_signals = ARRAY[
    'arm', 'risc-v', 'amba', 'axi', 'synopsys', 'cadence',
    'systemverilog', 'verilog', 'chisel', 'dft', 'mbist'
  ]
WHERE specialty_normalized = 'soc_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'dsp engineer', 'digital signal processing engineer',
    'signal processing engineer', 'algorithm engineer'
  ],
  keyword_signals = ARRAY[
    'digital signal processing', 'dsp', 'signal processing',
    'filter design', 'fft', 'convolution', 'adaptive filter',
    'audio processing', 'image processing', 'beamforming',
    'spectral analysis', 'sampling'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'python', 'c', 'c++', 'fpga', 'vhdl',
    'verilog', 'ti dsp', 'numpy', 'scipy', 'cuda'
  ]
WHERE specialty_normalized = 'dsp_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'chip architect', 'cpu architect', 'microarchitect',
    'processor architect', 'soc architect'
  ],
  keyword_signals = ARRAY[
    'chip architecture', 'microarchitecture', 'cpu design',
    'instruction set', 'isa', 'pipeline', 'cache architecture',
    'memory hierarchy', 'branch prediction', 'out-of-order execution',
    'gpu architecture', 'npu architecture'
  ],
  technology_signals = ARRAY[
    'arm', 'risc-v', 'x86', 'mips', 'systemverilog', 'verilog',
    'gem5', 'synopsys', 'cadence', 'c++', 'python'
  ]
WHERE specialty_normalized = 'chip_architecture';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'physical design engineer', 'pd engineer', 'backend design engineer',
    'ic layout engineer', 'place and route engineer', 'pnr engineer'
  ],
  keyword_signals = ARRAY[
    'physical design', 'place and route', 'pnr', 'floorplan',
    'clock tree synthesis', 'cts', 'timing closure', 'power grid',
    'signal integrity', 'ir drop', 'electromigration', 'drc', 'lvs'
  ],
  technology_signals = ARRAY[
    'innovus', 'icc2', 'primetime', 'calibre', 'assura', 'icv',
    'tempus', 'voltus', 'redhawk', 'synopsys', 'cadence', 'tcl'
  ]
WHERE specialty_normalized = 'physical_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'chip verification engineer', 'silicon validation engineer',
    'post-silicon engineer', 'silicon bring-up engineer'
  ],
  keyword_signals = ARRAY[
    'chip verification', 'silicon validation', 'post-silicon',
    'silicon bring-up', 'tapeout', 'tape-out', 'first silicon',
    'silicon debug', 'chip characterization', 'yield analysis'
  ],
  technology_signals = ARRAY[
    'oscilloscope', 'logic analyzer', 'jtag', 'python', 'perl',
    'tcl', 'systemverilog', 'verilog', 'emulator', 'protium', 'palladium'
  ]
WHERE specialty_normalized = 'chip_verification';

-- ============================================================
-- ENGINEERING — Hardware General
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hardware engineer', 'hardware design engineer', 'hw engineer',
    'electronics hardware engineer', 'product hardware engineer'
  ],
  keyword_signals = ARRAY[
    'hardware design', 'hardware development', 'product hardware',
    'electronics design', 'system design', 'prototype', 'bring-up',
    'hardware debug', 'board bring-up', 'test fixture'
  ],
  technology_signals = ARRAY[
    'altium', 'orcad', 'cadence', 'solidworks', 'oscilloscope',
    'logic analyzer', 'multimeter', 'soldering', 'pcb', 'schematic'
  ]
WHERE specialty_normalized = 'hardware_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hardware design engineer', 'electronics designer',
    'board design engineer', 'hw design engineer'
  ],
  keyword_signals = ARRAY[
    'hardware design', 'board design', 'electronics design',
    'system architecture', 'component selection', 'design review',
    'schematic review', 'design validation', 'emc compliance'
  ],
  technology_signals = ARRAY[
    'altium', 'orcad', 'cadence', 'eagle', 'kicad',
    'ltspice', 'solidworks', 'autocad', '3d printing'
  ]
WHERE specialty_normalized = 'hardware_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'prototyping engineer', 'rapid prototyping engineer',
    'prototype engineer', 'proof-of-concept engineer'
  ],
  keyword_signals = ARRAY[
    'prototyping', 'rapid prototyping', 'proof of concept', 'poc',
    'breadboard', 'prototype build', '3d printing', 'cnc',
    'laser cutting', 'mockup', 'functional prototype'
  ],
  technology_signals = ARRAY[
    '3d printing', 'cnc', 'laser cutter', 'arduino', 'raspberry pi',
    'solidworks', 'fusion 360', 'altium', 'soldering', 'pcb assembly'
  ]
WHERE specialty_normalized = 'prototyping';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'electromechanical engineer', 'electro-mechanical engineer',
    'mechatronic system engineer'
  ],
  keyword_signals = ARRAY[
    'electromechanical', 'electro-mechanical', 'motor integration',
    'actuator integration', 'sensor integration', 'wiring harness',
    'cable routing', 'connector', 'mechanical-electrical interface'
  ],
  technology_signals = ARRAY[
    'solidworks', 'altium', 'creo', 'autocad electrical',
    'eplan', 'labview', 'matlab', 'python'
  ]
WHERE specialty_normalized = 'electromechanical_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hardware integration engineer', 'systems integration engineer',
    'integration and test engineer', 'i&t engineer'
  ],
  keyword_signals = ARRAY[
    'hardware integration', 'system integration', 'integration and test',
    'i&t', 'assembly integration', 'subsystem integration',
    'interface verification', 'acceptance test', 'integration test'
  ],
  technology_signals = ARRAY[
    'labview', 'teststand', 'python', 'matlab', 'oscilloscope',
    'multimeter', 'data acquisition', 'daq', 'gpib', 'modbus'
  ]
WHERE specialty_normalized = 'hardware_integration';

-- ============================================================
-- ENGINEERING — Aerospace
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'aerodynamics engineer', 'aero engineer', 'aerodynamicist',
    'aerodynamic design engineer', 'flight sciences engineer'
  ],
  keyword_signals = ARRAY[
    'aerodynamics', 'aerodynamic design', 'wind tunnel', 'cfd',
    'lift', 'drag', 'airfoil', 'wing design', 'flow separation',
    'boundary layer', 'compressible flow', 'mach number'
  ],
  technology_signals = ARRAY[
    'ansys fluent', 'star-ccm+', 'openfoam', 'matlab', 'python',
    'xfoil', 'vspaero', 'overflow', 'fun3d', 'cart3d', 'tecplot'
  ]
WHERE specialty_normalized = 'aerodynamics';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'flight dynamics engineer', 'flight mechanics engineer',
    'vehicle dynamics engineer', '6dof engineer'
  ],
  keyword_signals = ARRAY[
    'flight dynamics', 'flight mechanics', '6dof', 'stability',
    'controllability', 'trim', 'flight envelope', 'flight simulation',
    'equations of motion', 'atmospheric model'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'python', 'jsbsim', 'flightgear',
    'x-plane', 'stk', 'fortran', 'c++'
  ]
WHERE specialty_normalized = 'flight_dynamics';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'aerospace structures engineer', 'aircraft structures engineer',
    'structural engineer - aerospace', 'composite structures engineer'
  ],
  keyword_signals = ARRAY[
    'aerospace structures', 'aircraft structures', 'fuselage',
    'wing structure', 'composite structure', 'damage tolerance',
    'fatigue', 'stress analysis', 'structural repair', 'airframe'
  ],
  technology_signals = ARRAY[
    'nastran', 'ansys', 'abaqus', 'hypermesh', 'femap', 'patran',
    'catia', 'solidworks', 'matlab', 'python'
  ]
WHERE specialty_normalized = 'aerospace_structures';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mission systems engineer', 'mission systems architect',
    'weapon systems engineer', 'payload systems engineer'
  ],
  keyword_signals = ARRAY[
    'mission systems', 'payload integration', 'sensor integration',
    'weapon system', 'ew', 'electronic warfare', 'mission planning',
    'kill chain', 'c4isr', 'mission computer'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'stk', 'python', 'c++', 'java',
    'doors', 'cameo', 'sysml', 'arinc 429', 'mil-std-1553'
  ]
WHERE specialty_normalized = 'mission_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'orbital mechanics engineer', 'astrodynamics engineer',
    'trajectory engineer', 'orbit analyst', 'mission design engineer'
  ],
  keyword_signals = ARRAY[
    'orbital mechanics', 'astrodynamics', 'trajectory design',
    'orbit determination', 'orbit transfer', 'rendezvous',
    'constellation design', 'launch window', 'delta-v', 'hohmann transfer'
  ],
  technology_signals = ARRAY[
    'stk', 'gmat', 'matlab', 'python', 'fortran', 'c++',
    'orekit', 'spice', 'monte'
  ]
WHERE specialty_normalized = 'orbital_mechanics';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'space systems engineer', 'spacecraft engineer', 'satellite engineer',
    'space vehicle engineer', 'spacecraft systems engineer'
  ],
  keyword_signals = ARRAY[
    'space systems', 'spacecraft', 'satellite', 'space vehicle',
    'launch vehicle', 'payload', 'command and data handling',
    'attitude control', 'power subsystem', 'thermal subsystem',
    'communication subsystem', 'structures subsystem'
  ],
  technology_signals = ARRAY[
    'stk', 'matlab', 'python', 'c', 'c++', 'doors',
    'cameo', 'sysml', 'ccsds', 'spice', 'thermal desktop'
  ]
WHERE specialty_normalized = 'space_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'avionics engineer', 'avionics systems engineer', 'avionics software engineer',
    'avionics hardware engineer', 'flight avionics engineer'
  ],
  keyword_signals = ARRAY[
    'avionics', 'flight computer', 'arinc', 'mil-std-1553',
    'do-178', 'do-254', 'flight management', 'autopilot',
    'display system', 'cockpit', 'efis', 'fms'
  ],
  technology_signals = ARRAY[
    'c', 'ada', 'vxworks', 'rtems', 'arinc 429', 'mil-std-1553',
    'can bus', 'afdx', 'matlab', 'simulink', 'doors', 'ldra'
  ]
WHERE specialty_normalized = 'avionics';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'gnc engineer', 'guidance navigation and control engineer',
    'gn&c engineer', 'guidance engineer', 'navigation and control engineer'
  ],
  keyword_signals = ARRAY[
    'gnc', 'guidance', 'navigation', 'control', 'attitude determination',
    'attitude control', 'kalman filter', 'state estimation', 'imu',
    'star tracker', 'reaction wheel', 'thruster control', 'autopilot'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'c', 'c++', 'python', 'fortran',
    'stk', 'adams', 'ros', 'fpga'
  ]
WHERE specialty_normalized = 'gnc';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'propulsion engineer', 'rocket engineer', 'propulsion systems engineer',
    'engine engineer', 'propulsion design engineer'
  ],
  keyword_signals = ARRAY[
    'propulsion', 'rocket engine', 'jet engine', 'thruster',
    'combustion', 'nozzle', 'turbopump', 'injector', 'propellant',
    'specific impulse', 'isp', 'thrust chamber', 'test stand'
  ],
  technology_signals = ARRAY[
    'ansys', 'openfoam', 'matlab', 'simulink', 'python', 'c++',
    'solidworks', 'catia', 'comsol', 'chemkin', 'cea'
  ]
WHERE specialty_normalized = 'propulsion';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'flight software engineer', 'flight sw engineer',
    'spacecraft software engineer', 'fsw engineer'
  ],
  keyword_signals = ARRAY[
    'flight software', 'fsw', 'spacecraft software', 'onboard software',
    'flight code', 'command sequencing', 'telemetry processing',
    'fault protection', 'autonomous operations'
  ],
  technology_signals = ARRAY[
    'c', 'c++', 'ada', 'python', 'rtems', 'vxworks', 'cfs',
    'core flight system', 'fprime', 'fpga', 'do-178'
  ]
WHERE specialty_normalized = 'flight_software';

-- ============================================================
-- ENGINEERING — Systems
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'systems engineer', 'system engineer', 'systems engineering lead',
    'senior systems engineer', 'staff systems engineer'
  ],
  keyword_signals = ARRAY[
    'systems engineering', 'system architecture', 'requirements',
    'interface control', 'system integration', 'v-model',
    'system verification', 'system validation', 'trade study',
    'conops', 'concept of operations'
  ],
  technology_signals = ARRAY[
    'doors', 'jama', 'polarion', 'cameo', 'sysml', 'matlab',
    'simulink', 'python', 'visio', 'enterprise architect'
  ]
WHERE specialty_normalized = 'systems_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'systems architect', 'system architect', 'technical architect',
    'solution architect', 'enterprise architect'
  ],
  keyword_signals = ARRAY[
    'systems architecture', 'system architecture', 'architecture trade',
    'interface definition', 'system decomposition', 'functional allocation',
    'performance budget', 'architectural decision', 'reference architecture'
  ],
  technology_signals = ARRAY[
    'cameo', 'sysml', 'uml', 'enterprise architect', 'sparx',
    'matlab', 'python', 'visio', 'lucidchart', 'draw.io'
  ]
WHERE specialty_normalized = 'systems_architecture';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'requirements engineer', 'requirements analyst', 'systems requirements engineer',
    'requirements management engineer'
  ],
  keyword_signals = ARRAY[
    'requirements', 'requirements engineering', 'requirements management',
    'traceability', 'verification matrix', 'specification',
    'requirement decomposition', 'derived requirement', 'shall statement'
  ],
  technology_signals = ARRAY[
    'doors', 'jama', 'polarion', 'requisitepro', 'helix rm',
    'excel', 'confluence', 'jira'
  ]
WHERE specialty_normalized = 'requirements_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mbse engineer', 'model-based systems engineer', 'digital engineering lead',
    'sysml engineer', 'model based engineer'
  ],
  keyword_signals = ARRAY[
    'mbse', 'model-based systems engineering', 'sysml', 'digital engineering',
    'model-based design', 'digital twin', 'system model',
    'executable model', 'architecture model'
  ],
  technology_signals = ARRAY[
    'cameo', 'magic draw', 'sysml', 'capella', 'papyrus',
    'sparx ea', 'matlab', 'simulink', 'modelica'
  ]
WHERE specialty_normalized = 'model_based_systems_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'integration and test engineer', 'i&t engineer', 'system integration engineer',
    'integration test engineer', 'integration engineer'
  ],
  keyword_signals = ARRAY[
    'integration and test', 'i&t', 'system integration', 'integration testing',
    'subsystem integration', 'interface verification', 'end-to-end test',
    'acceptance test', 'factory acceptance'
  ],
  technology_signals = ARRAY[
    'labview', 'teststand', 'python', 'matlab', 'doors',
    'jira', 'test automation', 'data acquisition'
  ]
WHERE specialty_normalized = 'integration_test';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mission integration engineer', 'mission integration lead',
    'vehicle integration engineer', 'launch integration engineer'
  ],
  keyword_signals = ARRAY[
    'mission integration', 'vehicle integration', 'launch integration',
    'payload integration', 'mission readiness', 'launch campaign',
    'countdown', 'mission rehearsal', 'flight readiness review'
  ],
  technology_signals = ARRAY[
    'python', 'matlab', 'doors', 'jira', 'confluence',
    'stk', 'cosmos', 'labview'
  ]
WHERE specialty_normalized = 'mission_integration';

-- ============================================================
-- ENGINEERING — Controls
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'controls engineer', 'control systems engineer', 'control engineer',
    'automation controls engineer', 'feedback control engineer'
  ],
  keyword_signals = ARRAY[
    'controls engineering', 'control systems', 'pid', 'control theory',
    'feedback control', 'state space', 'transfer function', 'bode plot',
    'stability analysis', 'root locus', 'gain scheduling',
    'robust control', 'adaptive control'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'labview', 'python', 'c', 'c++',
    'plc', 'scada', 'dspace', 'national instruments', 'ni'
  ]
WHERE specialty_normalized = 'controls_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'control systems engineer', 'control system designer',
    'advanced controls engineer'
  ],
  keyword_signals = ARRAY[
    'control system', 'mpc', 'model predictive control', 'lqr',
    'optimal control', 'nonlinear control', 'system identification',
    'plant modeling', 'controller design', 'control synthesis'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'python', 'scipy', 'control toolbox',
    'dspace', 'c', 'c++', 'ros', 'casadi'
  ]
WHERE specialty_normalized = 'control_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'autonomy engineer', 'autonomous systems engineer',
    'autonomy architect', 'autonomy stack engineer'
  ],
  keyword_signals = ARRAY[
    'autonomy', 'autonomous system', 'decision making', 'behavior tree',
    'state machine', 'mission planner', 'task allocation',
    'multi-agent', 'swarm', 'autonomous navigation'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'c++', 'python', 'matlab', 'simulink',
    'gazebo', 'carla', 'airsim', 'px4', 'ardupilot'
  ]
WHERE specialty_normalized = 'autonomy_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'guidance engineer', 'guidance systems engineer',
    'guidance algorithm engineer', 'missile guidance engineer'
  ],
  keyword_signals = ARRAY[
    'guidance', 'guidance system', 'guidance algorithm', 'proportional navigation',
    'terminal guidance', 'midcourse guidance', 'guidance law',
    'trajectory shaping', 'pursuit guidance'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'c', 'c++', 'fortran', 'python',
    'stk', 'six-dof simulation'
  ]
WHERE specialty_normalized = 'guidance_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'navigation engineer', 'navigation systems engineer',
    'ins engineer', 'inertial navigation engineer'
  ],
  keyword_signals = ARRAY[
    'navigation', 'inertial navigation', 'ins', 'gps', 'gnss',
    'ins/gps', 'dead reckoning', 'position estimation',
    'navigation filter', 'terrain-referenced navigation'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'c', 'c++', 'python',
    'imu', 'gps receiver', 'kalman filter', 'fpga'
  ]
WHERE specialty_normalized = 'navigation_engineering';

-- ============================================================
-- ENGINEERING — Robotics
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'robotic perception engineer', 'robot perception engineer',
    'perception engineer - robotics', 'robot vision engineer'
  ],
  keyword_signals = ARRAY[
    'robotic perception', 'robot vision', 'object recognition',
    'scene understanding', '3d perception', 'point cloud processing',
    'depth sensing', 'stereo vision', 'semantic segmentation'
  ],
  technology_signals = ARRAY[
    'opencv', 'pcl', 'open3d', 'pytorch', 'tensorflow',
    'ros', 'ros2', 'c++', 'python', 'lidar', 'depth camera'
  ]
WHERE specialty_normalized = 'robotic_perception';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'robotic manipulation engineer', 'manipulation engineer',
    'grasping engineer', 'robot manipulation engineer'
  ],
  keyword_signals = ARRAY[
    'manipulation', 'grasping', 'pick and place', 'dexterous manipulation',
    'force control', 'impedance control', 'grasp planning',
    'contact modeling', 'tactile sensing', 'bin picking'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'moveit', 'c++', 'python', 'drake',
    'mujoco', 'isaac sim', 'pybullet', 'gazebo'
  ]
WHERE specialty_normalized = 'robotic_manipulation';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'robot navigation engineer', 'autonomous navigation engineer',
    'mobile robot engineer', 'robot localization engineer'
  ],
  keyword_signals = ARRAY[
    'robot navigation', 'autonomous navigation', 'path planning',
    'obstacle avoidance', 'localization', 'mapping',
    'costmap', 'global planner', 'local planner', 'waypoint following'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'navigation2', 'nav2', 'c++', 'python',
    'lidar', 'slam', 'rtab-map', 'cartographer', 'move_base'
  ]
WHERE specialty_normalized = 'robotic_navigation';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ros engineer', 'ros developer', 'ros2 engineer', 'ros2 developer',
    'robotics middleware engineer'
  ],
  keyword_signals = ARRAY[
    'ros', 'ros2', 'robot operating system', 'ros node', 'ros topic',
    'ros service', 'ros action', 'launch file', 'ros package',
    'tf2', 'rviz', 'rosbag'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'c++', 'python', 'cmake', 'colcon', 'catkin',
    'gazebo', 'rviz', 'tf2', 'rclcpp', 'rclpy', 'dds'
  ]
WHERE specialty_normalized = 'ros_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'robotics integration engineer', 'robot integration engineer',
    'robot systems engineer', 'full-stack robotics engineer'
  ],
  keyword_signals = ARRAY[
    'robotics integration', 'robot integration', 'robot system',
    'robot commissioning', 'robot deployment', 'workcell',
    'robot cell', 'end-to-end robot', 'field robotics'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'c++', 'python', 'plc', 'ur',
    'fanuc', 'kuka', 'abb', 'gazebo', 'docker'
  ]
WHERE specialty_normalized = 'robotics_integration';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'autonomous systems engineer', 'autonomous vehicle engineer',
    'av engineer', 'self-driving engineer', 'unmanned systems engineer'
  ],
  keyword_signals = ARRAY[
    'autonomous systems', 'autonomous vehicle', 'self-driving',
    'unmanned system', 'uas', 'uav', 'drone', 'agv',
    'autonomous driving', 'level 4', 'level 5', 'adas'
  ],
  technology_signals = ARRAY[
    'ros', 'ros2', 'c++', 'python', 'autoware', 'apollo',
    'carla', 'sumo', 'lgsvl', 'nvidia drive', 'mobileye'
  ]
WHERE specialty_normalized = 'autonomous_systems_engineering';

-- ============================================================
-- ENGINEERING — Manufacturing/Production
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'manufacturing engineer', 'production engineer', 'process engineer',
    'manufacturing process engineer', 'plant engineer'
  ],
  keyword_signals = ARRAY[
    'manufacturing', 'production', 'factory', 'lean manufacturing',
    'six sigma', 'kaizen', 'yield improvement', 'throughput',
    'production line', 'work instruction', 'process control'
  ],
  technology_signals = ARRAY[
    'solidworks', 'autocad', 'minitab', 'sap', 'mes', 'erp',
    'plc', 'python', 'excel', 'labview', 'jira'
  ]
WHERE specialty_normalized = 'manufacturing_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'process engineer', 'manufacturing process engineer',
    'process development engineer', 'process optimization engineer'
  ],
  keyword_signals = ARRAY[
    'process engineering', 'process development', 'process optimization',
    'process control', 'spc', 'doe', 'process validation',
    'process capability', 'cpk', 'process flow'
  ],
  technology_signals = ARRAY[
    'minitab', 'jmp', 'python', 'matlab', 'sap', 'mes',
    'spc software', 'excel', 'labview'
  ]
WHERE specialty_normalized = 'process_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'automation engineer', 'factory automation engineer',
    'industrial automation engineer', 'controls and automation engineer'
  ],
  keyword_signals = ARRAY[
    'automation', 'factory automation', 'industrial automation',
    'plc programming', 'hmi', 'scada', 'robot programming',
    'conveyor', 'vision system', 'automated test'
  ],
  technology_signals = ARRAY[
    'plc', 'ladder logic', 'siemens', 'allen-bradley', 'rockwell',
    'beckhoff', 'hmi', 'scada', 'fanuc', 'abb', 'kuka',
    'python', 'labview', 'codesys'
  ]
WHERE specialty_normalized = 'automation_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'industrial engineer', 'ie', 'process improvement engineer',
    'lean engineer', 'continuous improvement engineer'
  ],
  keyword_signals = ARRAY[
    'industrial engineering', 'lean', 'six sigma', 'kaizen',
    'value stream mapping', 'time study', 'ergonomics',
    'facility layout', 'work cell design', 'capacity planning'
  ],
  technology_signals = ARRAY[
    'minitab', 'arena', 'flexsim', 'autocad', 'visio',
    'excel', 'sap', 'python', 'tableau'
  ]
WHERE specialty_normalized = 'industrial_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'production engineer', 'production line engineer',
    'manufacturing production engineer', 'production systems engineer'
  ],
  keyword_signals = ARRAY[
    'production', 'production line', 'assembly line', 'throughput',
    'cycle time', 'takt time', 'oee', 'downtime reduction',
    'production planning', 'production schedule'
  ],
  technology_signals = ARRAY[
    'sap', 'mes', 'erp', 'excel', 'python', 'plc',
    'minitab', 'autocad', 'solidworks'
  ]
WHERE specialty_normalized = 'production_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'supply chain engineer', 'supply chain manager', 'procurement engineer',
    'logistics engineer', 'supply chain analyst'
  ],
  keyword_signals = ARRAY[
    'supply chain', 'procurement', 'logistics', 'vendor management',
    'supplier quality', 'inventory management', 'demand planning',
    'sourcing', 'make vs buy', 'lead time', 'bom management'
  ],
  technology_signals = ARRAY[
    'sap', 'oracle', 'netsuite', 'excel', 'tableau', 'python',
    'arena', 'erp', 'mrp', 'plm'
  ]
WHERE specialty_normalized = 'supply_chain_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'assembly engineer', 'assembly process engineer',
    'final assembly engineer', 'assembly line engineer'
  ],
  keyword_signals = ARRAY[
    'assembly', 'final assembly', 'assembly process', 'work instruction',
    'assembly fixture', 'torque spec', 'fastener', 'adhesive bonding',
    'assembly sequence', 'assembly line design'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'autocad', 'excel', 'plc',
    'torque wrench', 'vision system', 'mes'
  ]
WHERE specialty_normalized = 'assembly_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'dfm engineer', 'design for manufacturing engineer',
    'manufacturability engineer', 'dfa engineer'
  ],
  keyword_signals = ARRAY[
    'dfm', 'design for manufacturing', 'design for assembly', 'dfa',
    'manufacturability', 'producibility', 'design review',
    'manufacturing feasibility', 'cost reduction', 'tolerance analysis'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'nx', 'dfma software', 'excel',
    'minitab', 'tolerance analysis', 'gd&t'
  ]
WHERE specialty_normalized = 'dfm_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'tooling engineer', 'tool design engineer', 'fixture engineer',
    'jig and fixture engineer', 'tooling design engineer'
  ],
  keyword_signals = ARRAY[
    'tooling', 'fixture', 'jig', 'mold design', 'die design',
    'tool design', 'injection mold', 'stamping die',
    'fixture design', 'gauge', 'checking fixture'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'nx', 'autocad', 'mastercam',
    'gd&t', 'cmm', 'cnc', 'edm'
  ]
WHERE specialty_normalized = 'tooling_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'fabrication engineer', 'fab engineer', 'manufacturing fabrication engineer',
    'sheet metal engineer', 'weld engineer'
  ],
  keyword_signals = ARRAY[
    'fabrication', 'welding', 'sheet metal', 'machining', 'forming',
    'brazing', 'soldering', 'laser cutting', 'waterjet',
    'metal forming', 'additive manufacturing'
  ],
  technology_signals = ARRAY[
    'solidworks', 'autocad', 'mastercam', 'cnc', 'tig', 'mig',
    'laser', 'waterjet', 'press brake', 'plasma'
  ]
WHERE specialty_normalized = 'fabrication_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'cnc programmer', 'cnc engineer', 'machinist engineer',
    'cnc machining engineer', 'cam programmer'
  ],
  keyword_signals = ARRAY[
    'cnc', 'machining', 'g-code', 'cam programming', 'turning',
    'milling', '5-axis', 'lathe', 'machine shop',
    'tool path', 'feed rate', 'spindle speed'
  ],
  technology_signals = ARRAY[
    'mastercam', 'fusion 360', 'solidcam', 'esprit', 'hypermill',
    'fanuc', 'haas', 'mazak', 'dmg mori', 'siemens nx cam'
  ]
WHERE specialty_normalized = 'machining';

-- ============================================================
-- ENGINEERING — Test/Reliability/Quality
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'test engineer', 'hardware test engineer', 'systems test engineer',
    'validation engineer', 'v&v engineer'
  ],
  keyword_signals = ARRAY[
    'test engineering', 'test plan', 'test procedure', 'test execution',
    'test automation', 'test fixture', 'data acquisition',
    'test report', 'anomaly investigation', 'regression test'
  ],
  technology_signals = ARRAY[
    'labview', 'teststand', 'python', 'matlab', 'oscilloscope',
    'multimeter', 'daq', 'ni', 'keysight', 'tektronix'
  ]
WHERE specialty_normalized = 'test_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'reliability engineer', 'reliability analysis engineer',
    'rams engineer', 'product reliability engineer'
  ],
  keyword_signals = ARRAY[
    'reliability', 'mtbf', 'mttr', 'failure rate', 'weibull',
    'fmea', 'fmeca', 'fault tree', 'reliability prediction',
    'accelerated life test', 'reliability growth', 'availability'
  ],
  technology_signals = ARRAY[
    'reliasoft', 'minitab', 'matlab', 'python', 'excel',
    'relex', 'isograph', 'jmp', 'r'
  ]
WHERE specialty_normalized = 'reliability_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'quality engineer', 'quality assurance engineer', 'qa engineer - hardware',
    'supplier quality engineer', 'quality control engineer'
  ],
  keyword_signals = ARRAY[
    'quality', 'quality assurance', 'quality control', 'inspection',
    'non-conformance', 'corrective action', 'capa', 'audit',
    'iso 9001', 'as9100', 'incoming inspection', 'first article'
  ],
  technology_signals = ARRAY[
    'minitab', 'sap', 'excel', 'cmm', 'gd&t', 'spc',
    'caliper', 'gauge', 'python', 'tableau'
  ]
WHERE specialty_normalized = 'quality_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hil engineer', 'hardware-in-the-loop engineer',
    'hil test engineer', 'hil simulation engineer'
  ],
  keyword_signals = ARRAY[
    'hardware-in-the-loop', 'hil', 'real-time simulation',
    'test bench', 'plant model', 'ecu testing',
    'closed-loop testing', 'fault injection', 'hil rig'
  ],
  technology_signals = ARRAY[
    'dspace', 'ni', 'speedgoat', 'opal-rt', 'matlab', 'simulink',
    'labview', 'python', 'can', 'canoe', 'vector'
  ]
WHERE specialty_normalized = 'hardware_in_loop';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'sil engineer', 'software-in-the-loop engineer',
    'sil test engineer', 'model-in-the-loop engineer'
  ],
  keyword_signals = ARRAY[
    'software-in-the-loop', 'sil', 'model-in-the-loop', 'mil',
    'simulation testing', 'virtual testing', 'autocode verification',
    'back-to-back testing', 'processor-in-the-loop', 'pil'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'python', 'c', 'c++',
    'embedded coder', 'polyspace', 'gcov', 'jenkins'
  ]
WHERE specialty_normalized = 'software_in_loop';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'validation engineer', 'product validation engineer',
    'design validation engineer', 'dvp&r engineer'
  ],
  keyword_signals = ARRAY[
    'validation', 'design validation', 'product validation',
    'dvp&r', 'test plan', 'acceptance criteria',
    'performance testing', 'endurance testing', 'life testing'
  ],
  technology_signals = ARRAY[
    'labview', 'teststand', 'python', 'matlab', 'minitab',
    'daq', 'data acquisition', 'excel', 'jmp'
  ]
WHERE specialty_normalized = 'validation_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'qualification engineer', 'quals engineer',
    'environmental qualification engineer', 'certification engineer'
  ],
  keyword_signals = ARRAY[
    'qualification', 'environmental qualification', 'mil-std-810',
    'do-160', 'thermal cycling', 'vibration qualification',
    'shock test', 'altitude test', 'humidity test', 'emi/emc test'
  ],
  technology_signals = ARRAY[
    'labview', 'teststand', 'python', 'thermal chamber',
    'shaker', 'accelerometer', 'data acquisition', 'matlab'
  ]
WHERE specialty_normalized = 'qualification_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'environmental test engineer', 'environmental testing engineer',
    'test lab engineer', 'stress screening engineer'
  ],
  keyword_signals = ARRAY[
    'environmental testing', 'thermal testing', 'vibration testing',
    'shock testing', 'humidity testing', 'altitude testing',
    'halt', 'hass', 'burn-in', 'stress screening', 'thermal vacuum'
  ],
  technology_signals = ARRAY[
    'thermal chamber', 'shaker table', 'labview', 'teststand',
    'accelerometer', 'thermocouple', 'data acquisition', 'python'
  ]
WHERE specialty_normalized = 'environmental_testing';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'failure analysis engineer', 'fa engineer', 'root cause analyst',
    'materials failure engineer', 'defect analysis engineer'
  ],
  keyword_signals = ARRAY[
    'failure analysis', 'root cause', 'rca', '8d', 'fishbone',
    'fault isolation', 'cross-section', 'sem', 'eds',
    'metallographic', 'fractography', 'corrective action'
  ],
  technology_signals = ARRAY[
    'sem', 'eds', 'optical microscope', 'x-ray', 'ct scan',
    'ftir', 'dsc', 'tga', 'minitab', 'python', 'excel'
  ]
WHERE specialty_normalized = 'failure_analysis';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'certification engineer', 'airworthiness engineer',
    'safety certification engineer', 'regulatory engineer'
  ],
  keyword_signals = ARRAY[
    'certification', 'airworthiness', 'type certificate',
    'do-178', 'do-254', 'iso 26262', 'iec 61508',
    'compliance', 'safety assessment', 'design assurance level', 'dal'
  ],
  technology_signals = ARRAY[
    'doors', 'ldra', 'polyspace', 'coverity', 'vectorcast',
    'matlab', 'simulink', 'excel', 'jira'
  ]
WHERE specialty_normalized = 'certification_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ground test engineer', 'static test engineer',
    'test campaign engineer', 'propulsion test engineer'
  ],
  keyword_signals = ARRAY[
    'ground test', 'static test', 'hot fire', 'test campaign',
    'test stand', 'propulsion test', 'structural test',
    'proof test', 'burst test', 'acceptance test'
  ],
  technology_signals = ARRAY[
    'labview', 'teststand', 'python', 'matlab', 'ni',
    'data acquisition', 'pressure transducer', 'load cell',
    'thermocouple', 'plc'
  ]
WHERE specialty_normalized = 'ground_test';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'flight test engineer', 'fte', 'flight test conductor',
    'experimental test pilot engineer', 'flight test analyst'
  ],
  keyword_signals = ARRAY[
    'flight test', 'flight test campaign', 'test point',
    'flight test instrumentation', 'fti', 'telemetry',
    'flight data analysis', 'envelope expansion', 'flutter test'
  ],
  technology_signals = ARRAY[
    'matlab', 'python', 'labview', 'iads', 'telemetry',
    'data acquisition', 'irig', 'gps', 'imu'
  ]
WHERE specialty_normalized = 'flight_test';

-- ============================================================
-- ENGINEERING — Optics/Photonics
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'optical engineer', 'optics engineer', 'lens designer',
    'optical design engineer', 'optical systems engineer'
  ],
  keyword_signals = ARRAY[
    'optical engineering', 'optics', 'lens design', 'optical design',
    'ray tracing', 'aberration', 'optical system', 'imaging',
    'telescope', 'microscope', 'interferometry'
  ],
  technology_signals = ARRAY[
    'zemax', 'code v', 'lighttools', 'fred', 'matlab', 'python',
    'solidworks', 'tracepro', 'oslo', 'synopsys'
  ]
WHERE specialty_normalized = 'optics_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'photonics engineer', 'photonic systems engineer',
    'fiber optics engineer', 'laser engineer'
  ],
  keyword_signals = ARRAY[
    'photonics', 'fiber optics', 'waveguide', 'photodetector',
    'led', 'photonic integrated circuit', 'pic', 'lidar',
    'spectroscopy', 'optical communication'
  ],
  technology_signals = ARRAY[
    'zemax', 'lumerical', 'comsol', 'matlab', 'python',
    'labview', 'oscilloscope', 'optical spectrum analyzer',
    'power meter', 'ber tester'
  ]
WHERE specialty_normalized = 'photonics_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'imaging systems engineer', 'camera engineer', 'image sensor engineer',
    'imaging engineer', 'vision systems engineer'
  ],
  keyword_signals = ARRAY[
    'imaging', 'camera system', 'image sensor', 'image processing',
    'image quality', 'lens calibration', 'isp', 'hdr',
    'machine vision', 'thermal imaging', 'multispectral'
  ],
  technology_signals = ARRAY[
    'opencv', 'matlab', 'python', 'c++', 'halcon',
    'genicam', 'gige vision', 'usb3 vision', 'cmos sensor',
    'ccd', 'fpga', 'isp'
  ]
WHERE specialty_normalized = 'imaging_systems';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'laser engineer', 'laser systems engineer', 'laser physicist',
    'laser application engineer'
  ],
  keyword_signals = ARRAY[
    'laser', 'laser system', 'laser source', 'fiber laser',
    'solid-state laser', 'diode laser', 'pulsed laser',
    'laser safety', 'beam quality', 'laser processing'
  ],
  technology_signals = ARRAY[
    'zemax', 'matlab', 'python', 'labview', 'comsol',
    'laser diode', 'fiber laser', 'dpss', 'aom', 'eom'
  ]
WHERE specialty_normalized = 'laser_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'optical designer', 'optical system designer', 'lens design engineer',
    'optical architect'
  ],
  keyword_signals = ARRAY[
    'optical design', 'lens design', 'ray tracing', 'optical prescription',
    'tolerance analysis', 'stray light', 'coating design',
    'diffraction', 'mtf', 'psf', 'wavefront'
  ],
  technology_signals = ARRAY[
    'zemax', 'code v', 'oslo', 'synopsys', 'matlab', 'python',
    'fred', 'lighttools', 'tracepro'
  ]
WHERE specialty_normalized = 'optical_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'optomechanical engineer', 'optomechanical designer',
    'opto-mechanical engineer', 'precision mechanical engineer'
  ],
  keyword_signals = ARRAY[
    'optomechanical', 'opto-mechanical', 'optical mount', 'lens mount',
    'precision alignment', 'flexure', 'kinematic mount',
    'thermal stability', 'vibration isolation', 'clean room'
  ],
  technology_signals = ARRAY[
    'solidworks', 'catia', 'creo', 'ansys', 'nastran',
    'zemax', 'matlab', 'python', 'gd&t', 'fea'
  ]
WHERE specialty_normalized = 'optomechanical_engineering';

-- ============================================================
-- ENGINEERING — Materials
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'materials engineer', 'materials scientist', 'material engineer',
    'materials and process engineer', 'm&p engineer'
  ],
  keyword_signals = ARRAY[
    'materials', 'materials engineering', 'materials science',
    'material selection', 'material properties', 'materials testing',
    'corrosion', 'coatings', 'surface treatment', 'heat treatment'
  ],
  technology_signals = ARRAY[
    'sem', 'eds', 'xrd', 'dsc', 'tga', 'ftir', 'tensile tester',
    'hardness tester', 'optical microscope', 'minitab', 'jmp'
  ]
WHERE specialty_normalized = 'materials_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'composites engineer', 'composite materials engineer',
    'composite structures engineer', 'composite design engineer'
  ],
  keyword_signals = ARRAY[
    'composites', 'carbon fiber', 'fiberglass', 'layup',
    'prepreg', 'autoclave', 'resin transfer', 'rtm',
    'laminate', 'ply schedule', 'composite repair'
  ],
  technology_signals = ARRAY[
    'abaqus', 'ansys', 'nastran', 'catia composites', 'fibersim',
    'matlab', 'solidworks', 'python', 'helius'
  ]
WHERE specialty_normalized = 'composites_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'metallurgist', 'metallurgical engineer', 'metals engineer',
    'metallurgy engineer'
  ],
  keyword_signals = ARRAY[
    'metallurgy', 'metallurgical', 'alloy', 'heat treatment',
    'welding metallurgy', 'phase diagram', 'microstructure',
    'grain structure', 'hardening', 'tempering', 'annealing'
  ],
  technology_signals = ARRAY[
    'sem', 'eds', 'xrd', 'optical microscope', 'hardness tester',
    'tensile tester', 'thermo-calc', 'jmatpro', 'dictra'
  ]
WHERE specialty_normalized = 'metallurgy';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'polymer engineer', 'plastics engineer', 'polymer scientist',
    'rubber engineer', 'elastomer engineer'
  ],
  keyword_signals = ARRAY[
    'polymer', 'plastics', 'elastomer', 'rubber', 'injection molding',
    'extrusion', 'thermoforming', 'polymer processing',
    'resin selection', 'additive formulation'
  ],
  technology_signals = ARRAY[
    'moldflow', 'solidworks plastics', 'dsc', 'tga', 'ftir',
    'dmta', 'rheometer', 'tensile tester', 'minitab'
  ]
WHERE specialty_normalized = 'polymer_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ceramics engineer', 'ceramic engineer', 'advanced materials engineer',
    'ceramic scientist'
  ],
  keyword_signals = ARRAY[
    'ceramics', 'ceramic', 'sintering', 'powder processing',
    'advanced ceramics', 'piezoelectric', 'dielectric',
    'refractory', 'glass', 'ceramic coating'
  ],
  technology_signals = ARRAY[
    'sem', 'xrd', 'dsc', 'tga', 'dilatometer', 'comsol',
    'ansys', 'matlab', 'python'
  ]
WHERE specialty_normalized = 'ceramics_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'materials characterization engineer', 'analytical engineer',
    'materials testing engineer', 'materials analyst'
  ],
  keyword_signals = ARRAY[
    'materials characterization', 'materials testing', 'analytical',
    'failure analysis', 'microscopy', 'spectroscopy', 'diffraction',
    'mechanical testing', 'thermal analysis', 'chemical analysis'
  ],
  technology_signals = ARRAY[
    'sem', 'tem', 'eds', 'xrd', 'xps', 'auger', 'ftir',
    'raman', 'afm', 'nanoindenter', 'tensile tester', 'dsc', 'tga'
  ]
WHERE specialty_normalized = 'materials_characterization';

-- ============================================================
-- ENGINEERING — Mechatronics
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mechatronics engineer', 'mechatronic engineer',
    'electromechanical systems engineer'
  ],
  keyword_signals = ARRAY[
    'mechatronics', 'electromechanical', 'actuator', 'sensor',
    'motor control', 'embedded systems', 'mechanical-electrical',
    'system integration', 'prototype', 'hardware-software'
  ],
  technology_signals = ARRAY[
    'solidworks', 'altium', 'matlab', 'simulink', 'c', 'c++',
    'arduino', 'stm32', 'labview', 'python', 'ros'
  ]
WHERE specialty_normalized = 'mechatronics';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'actuator engineer', 'actuator design engineer',
    'actuation systems engineer', 'linear actuator engineer'
  ],
  keyword_signals = ARRAY[
    'actuator', 'actuation', 'linear actuator', 'rotary actuator',
    'electric actuator', 'hydraulic actuator', 'pneumatic actuator',
    'servo actuator', 'actuator control', 'force output'
  ],
  technology_signals = ARRAY[
    'solidworks', 'matlab', 'simulink', 'c', 'altium',
    'labview', 'python', 'ansys', 'motor drive'
  ]
WHERE specialty_normalized = 'actuator_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'servo engineer', 'servo systems engineer', 'servo control engineer',
    'motion control engineer'
  ],
  keyword_signals = ARRAY[
    'servo', 'servo system', 'servo tuning', 'servo control',
    'motion control', 'position control', 'velocity control',
    'servo drive', 'servo motor', 'closed-loop control'
  ],
  technology_signals = ARRAY[
    'matlab', 'simulink', 'c', 'c++', 'labview', 'elmo',
    'copley', 'galil', 'beckhoff', 'ethercat', 'can bus'
  ]
WHERE specialty_normalized = 'servo_engineering';

-- ============================================================
-- ENGINEERING — Thermal
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'thermal engineer', 'thermal design engineer', 'thermal analyst',
    'thermal management engineer', 'cooling engineer'
  ],
  keyword_signals = ARRAY[
    'thermal', 'thermal design', 'thermal analysis', 'heat dissipation',
    'cooling system', 'heat sink', 'thermal interface', 'thermal simulation',
    'thermal management', 'thermal vacuum', 'cryogenic'
  ],
  technology_signals = ARRAY[
    'ansys icepak', 'flotherm', 'thermal desktop', 'comsol',
    'star-ccm+', 'solidworks simulation', 'matlab', 'python',
    'ansys fluent', '6sigma'
  ]
WHERE specialty_normalized = 'thermal_engineering';

-- ============================================================
-- ENGINEERING — Structural
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'structural engineer', 'structural design engineer',
    'structural analyst', 'structures engineer'
  ],
  keyword_signals = ARRAY[
    'structural engineering', 'structural design', 'structural analysis',
    'finite element', 'loads', 'stress', 'fatigue',
    'buckling', 'composite structures', 'metallic structures'
  ],
  technology_signals = ARRAY[
    'nastran', 'ansys', 'abaqus', 'hypermesh', 'femap',
    'patran', 'catia', 'solidworks', 'matlab', 'python'
  ]
WHERE specialty_normalized = 'structural_engineering';

-- ============================================================
-- ENGINEERING — Power Electronics
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'power electronics engineer', 'power conversion engineer',
    'power supply engineer', 'pe engineer'
  ],
  keyword_signals = ARRAY[
    'power electronics', 'power conversion', 'dc-dc converter',
    'inverter', 'rectifier', 'switch-mode', 'smps',
    'gate driver', 'pwm', 'transformer design', 'inductor design'
  ],
  technology_signals = ARRAY[
    'ltspice', 'plecs', 'matlab', 'simulink', 'altium',
    'sic', 'gan', 'igbt', 'mosfet', 'ti', 'infineon',
    'psim', 'spice'
  ]
WHERE specialty_normalized = 'power_electronics';

-- ============================================================
-- ENGINEERING — Firmware (migration 016 base entry)
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'firmware engineer', 'firmware developer', 'fw engineer',
    'embedded firmware engineer', 'firmware software engineer'
  ],
  keyword_signals = ARRAY[
    'firmware', 'fw development', 'embedded firmware', 'bare metal',
    'bootloader', 'ota update', 'flash memory', 'watchdog',
    'interrupt service', 'peripheral configuration'
  ],
  technology_signals = ARRAY[
    'c', 'c++', 'assembly', 'arm', 'cortex-m', 'stm32', 'esp32',
    'freertos', 'zephyr', 'keil', 'iar', 'jtag', 'swd',
    'spi', 'i2c', 'uart', 'can', 'gpio'
  ]
WHERE specialty_normalized = 'firmware';

-- ============================================================
-- ENGINEERING — Leadership
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'engineering manager', 'em', 'software engineering manager',
    'hardware engineering manager', 'engineering lead',
    'director of engineering', 'head of engineering'
  ],
  keyword_signals = ARRAY[
    'engineering management', 'team leadership', 'people management',
    'hiring', 'performance review', 'roadmap', 'sprint planning',
    'agile', 'cross-functional', 'technical leadership'
  ],
  technology_signals = ARRAY[
    'jira', 'confluence', 'github', 'gitlab', 'linear',
    'notion', 'figma', 'slack'
  ]
WHERE specialty_normalized = 'engineering_management';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'technical program manager', 'tpm', 'technical pm',
    'engineering program manager', 'epm'
  ],
  keyword_signals = ARRAY[
    'technical program management', 'tpm', 'program management',
    'cross-team coordination', 'dependency management', 'milestone tracking',
    'risk management', 'stakeholder management', 'launch coordination'
  ],
  technology_signals = ARRAY[
    'jira', 'asana', 'smartsheet', 'confluence', 'excel',
    'ms project', 'airtable', 'notion', 'linear'
  ]
WHERE specialty_normalized = 'technical_program_management';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'principal engineer', 'staff engineer', 'distinguished engineer',
    'fellow engineer', 'chief engineer'
  ],
  keyword_signals = ARRAY[
    'technical strategy', 'architecture review', 'tech debt',
    'cross-org', 'technical vision', 'system design',
    'engineering excellence', 'design review', 'mentorship'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'principal_engineer';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'distinguished engineer', 'fellow', 'engineering fellow',
    'distinguished technologist'
  ],
  keyword_signals = ARRAY[
    'industry leadership', 'thought leadership', 'patent',
    'publication', 'keynote', 'standards body', 'open source governance',
    'technical advisory', 'board of advisors'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'distinguished_engineer';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'chief engineer', 'chief technology officer', 'cto',
    'vp of engineering', 'svp engineering'
  ],
  keyword_signals = ARRAY[
    'chief engineer', 'technical direction', 'engineering organization',
    'technology strategy', 'r&d leadership', 'technical roadmap',
    'architecture governance', 'build vs buy'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'chief_engineer';

-- ============================================================
-- PRODUCT MANAGEMENT
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'product manager', 'pm', 'product manager - b2b',
    'enterprise product manager', 'b2b product manager'
  ],
  keyword_signals = ARRAY[
    'product management', 'product strategy', 'product roadmap',
    'user research', 'prd', 'product requirements', 'feature prioritization',
    'stakeholder alignment', 'go-to-market', 'product metrics', 'okr'
  ],
  technology_signals = ARRAY[
    'jira', 'productboard', 'amplitude', 'mixpanel', 'figma',
    'notion', 'confluence', 'sql', 'tableau', 'looker'
  ]
WHERE specialty_normalized = 'product_b2b';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'product manager - consumer', 'consumer product manager',
    'b2c product manager', 'mobile product manager'
  ],
  keyword_signals = ARRAY[
    'consumer product', 'b2c', 'user engagement', 'retention',
    'activation', 'onboarding', 'viral growth', 'social',
    'marketplace', 'user acquisition', 'ltv', 'dau', 'mau'
  ],
  technology_signals = ARRAY[
    'amplitude', 'mixpanel', 'segment', 'braze', 'figma',
    'fullstory', 'hotjar', 'firebase', 'app store connect'
  ]
WHERE specialty_normalized = 'product_consumer';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'platform product manager', 'infrastructure product manager',
    'developer platform pm', 'api product manager'
  ],
  keyword_signals = ARRAY[
    'platform', 'developer platform', 'api product', 'platform strategy',
    'developer experience', 'dx', 'internal tooling', 'platform adoption',
    'self-serve', 'sdk', 'api'
  ],
  technology_signals = ARRAY[
    'jira', 'swagger', 'postman', 'github', 'datadog',
    'grafana', 'amplitude', 'sql', 'notion'
  ]
WHERE specialty_normalized = 'product_platform';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'growth product manager', 'growth pm', 'product manager - growth',
    'experimentation pm'
  ],
  keyword_signals = ARRAY[
    'growth', 'experimentation', 'a/b testing', 'conversion',
    'funnel optimization', 'acquisition', 'activation', 'retention',
    'monetization', 'growth loops', 'virality'
  ],
  technology_signals = ARRAY[
    'amplitude', 'optimizely', 'launchdarkly', 'statsig',
    'mixpanel', 'segment', 'sql', 'python', 'r'
  ]
WHERE specialty_normalized = 'product_growth';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hardware product manager', 'hardware pm',
    'product manager - hardware', 'physical product manager'
  ],
  keyword_signals = ARRAY[
    'hardware product', 'physical product', 'bill of materials',
    'manufacturing', 'supply chain', 'npi', 'new product introduction',
    'certification', 'tooling', 'unit economics'
  ],
  technology_signals = ARRAY[
    'jira', 'confluence', 'arena', 'plm', 'sap',
    'solidworks', 'excel', 'airtable'
  ]
WHERE specialty_normalized = 'hardware_pm';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'platform pm', 'platform product manager',
    'internal platform pm', 'tooling pm'
  ],
  keyword_signals = ARRAY[
    'platform product', 'internal platform', 'developer tools',
    'infrastructure product', 'platform reliability', 'platform adoption'
  ],
  technology_signals = ARRAY[
    'jira', 'notion', 'confluence', 'github', 'datadog',
    'amplitude', 'sql'
  ]
WHERE specialty_normalized = 'platform_pm';

-- ============================================================
-- DESIGN
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ux designer', 'user experience designer', 'ux/ui designer',
    'experience designer', 'senior ux designer'
  ],
  keyword_signals = ARRAY[
    'ux design', 'user experience', 'usability', 'user research',
    'wireframe', 'prototype', 'user flow', 'information architecture',
    'heuristic evaluation', 'accessibility', 'design thinking'
  ],
  technology_signals = ARRAY[
    'figma', 'sketch', 'adobe xd', 'invision', 'miro',
    'usertesting', 'maze', 'optimal workshop', 'hotjar',
    'framer', 'principle', 'axure'
  ]
WHERE specialty_normalized = 'ux_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'product designer', 'digital product designer',
    'senior product designer', 'staff product designer'
  ],
  keyword_signals = ARRAY[
    'product design', 'end-to-end design', 'design system',
    'visual design', 'interaction design', 'high fidelity',
    'design sprint', 'design critique', 'cross-functional'
  ],
  technology_signals = ARRAY[
    'figma', 'sketch', 'framer', 'protopie', 'principle',
    'zeplin', 'abstract', 'storybook', 'css', 'html'
  ]
WHERE specialty_normalized = 'product_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'brand designer', 'visual designer', 'graphic designer',
    'brand identity designer', 'creative designer'
  ],
  keyword_signals = ARRAY[
    'brand design', 'visual identity', 'brand guidelines', 'logo design',
    'typography', 'brand system', 'creative direction', 'illustration',
    'marketing design', 'campaign design'
  ],
  technology_signals = ARRAY[
    'adobe illustrator', 'adobe photoshop', 'figma', 'after effects',
    'indesign', 'cinema 4d', 'blender', 'procreate'
  ]
WHERE specialty_normalized = 'brand_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'industrial designer', 'id', 'product industrial designer',
    'consumer product designer', 'cmf designer'
  ],
  keyword_signals = ARRAY[
    'industrial design', 'form factor', 'cmf', 'color material finish',
    'sketch rendering', 'concept development', 'user-centered design',
    'physical product design', 'ergonomics', 'human factors'
  ],
  technology_signals = ARRAY[
    'solidworks', 'rhino', 'keyshot', 'alias', 'fusion 360',
    'adobe illustrator', 'photoshop', 'blender', 'gravity sketch',
    'substance painter'
  ]
WHERE specialty_normalized = 'industrial_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'hardware product designer', 'physical product designer',
    'design engineer', 'hw product designer'
  ],
  keyword_signals = ARRAY[
    'hardware product design', 'physical product', 'prototype',
    'design for manufacturing', 'user testing', 'product development',
    'concept to production', 'industrial design engineering'
  ],
  technology_signals = ARRAY[
    'solidworks', 'creo', 'fusion 360', 'keyshot', 'rhino',
    '3d printing', 'cnc', 'injection molding'
  ]
WHERE specialty_normalized = 'hardware_product_design';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'mechanical design engineer', 'design engineer - mechanical',
    'product design engineer'
  ],
  keyword_signals = ARRAY[
    'mechanical design engineering', 'design engineering',
    'aesthetics and mechanics', 'cad/cam', 'design iteration',
    'fit and finish', 'tolerance stack'
  ],
  technology_signals = ARRAY[
    'solidworks', 'creo', 'nx', 'catia', 'fusion 360',
    'keyshot', 'gd&t', 'fea'
  ]
WHERE specialty_normalized = 'mechanical_design_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'human factors engineer', 'ergonomics engineer',
    'human factors specialist', 'hfe'
  ],
  keyword_signals = ARRAY[
    'human factors', 'ergonomics', 'human-machine interface', 'hmi',
    'cockpit design', 'workstation design', 'user interface design',
    'cognitive engineering', 'human error analysis', 'usability'
  ],
  technology_signals = ARRAY[
    'figma', 'sketch', 'solidworks', 'catia', 'jack',
    'matlab', 'eye tracking', 'motion capture'
  ]
WHERE specialty_normalized = 'human_factors_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'interaction designer', 'ixd', 'ui interaction designer',
    'motion designer', 'ui animator'
  ],
  keyword_signals = ARRAY[
    'interaction design', 'micro-interaction', 'motion design',
    'animation', 'transition', 'gesture', 'haptic feedback',
    'interactive prototype', 'user flow animation'
  ],
  technology_signals = ARRAY[
    'figma', 'principle', 'protopie', 'framer', 'after effects',
    'lottie', 'rive', 'css animation', 'gsap'
  ]
WHERE specialty_normalized = 'interaction_design';

-- ============================================================
-- OPERATIONS
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'business operations manager', 'biz ops', 'operations manager',
    'business operations lead', 'head of operations'
  ],
  keyword_signals = ARRAY[
    'business operations', 'biz ops', 'operational efficiency',
    'process improvement', 'cross-functional', 'metrics',
    'reporting', 'budget management', 'vendor management'
  ],
  technology_signals = ARRAY[
    'excel', 'google sheets', 'notion', 'airtable', 'asana',
    'slack', 'tableau', 'looker', 'sql', 'salesforce'
  ]
WHERE specialty_normalized = 'business_operations';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'chief of staff', 'cos', 'chief of staff to ceo',
    'executive chief of staff'
  ],
  keyword_signals = ARRAY[
    'chief of staff', 'ceo office', 'strategic initiatives',
    'board prep', 'investor relations', 'executive communication',
    'special projects', 'cross-functional coordination'
  ],
  technology_signals = ARRAY[
    'google workspace', 'notion', 'excel', 'powerpoint',
    'slack', 'asana', 'salesforce'
  ]
WHERE specialty_normalized = 'chief_of_staff';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'program manager', 'senior program manager', 'program management lead',
    'portfolio manager', 'pgm'
  ],
  keyword_signals = ARRAY[
    'program management', 'portfolio management', 'milestone',
    'dependency', 'risk management', 'stakeholder management',
    'governance', 'budget tracking', 'resource allocation'
  ],
  technology_signals = ARRAY[
    'jira', 'asana', 'smartsheet', 'ms project', 'confluence',
    'excel', 'airtable', 'monday.com'
  ]
WHERE specialty_normalized = 'program_management';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'strategy and operations', 'stratops', 'strategy & operations',
    'strategy operations manager', 'strategic operations lead'
  ],
  keyword_signals = ARRAY[
    'strategy', 'strategic planning', 'market analysis',
    'competitive analysis', 'business model', 'go-to-market strategy',
    'growth strategy', 'operational strategy', 'scenario planning'
  ],
  technology_signals = ARRAY[
    'excel', 'google sheets', 'sql', 'tableau', 'powerpoint',
    'notion', 'airtable', 'python'
  ]
WHERE specialty_normalized = 'strategy_operations';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'operations lead', 'operations coordinator', 'operations specialist',
    'business operations associate'
  ],
  keyword_signals = ARRAY[
    'operations', 'operational', 'process', 'workflow',
    'coordination', 'logistics', 'scaling', 'efficiency'
  ],
  technology_signals = ARRAY[
    'excel', 'google sheets', 'notion', 'asana', 'slack',
    'airtable', 'zendesk', 'salesforce'
  ]
WHERE specialty_normalized = 'operations_general';

-- ============================================================
-- SALES
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'enterprise sales rep', 'enterprise account executive',
    'enterprise sales director', 'strategic account executive'
  ],
  keyword_signals = ARRAY[
    'enterprise sales', 'large deal', 'complex sale', 'multi-stakeholder',
    'procurement', 'rfp', 'solution selling', 'consultative selling',
    'executive sponsor', 'champion building', 'contract negotiation'
  ],
  technology_signals = ARRAY[
    'salesforce', 'hubspot', 'gong', 'chorus', 'clari',
    'outreach', 'linkedin sales navigator', 'zoom info'
  ]
WHERE specialty_normalized = 'enterprise_sales';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'smb sales rep', 'smb account executive', 'mid-market ae',
    'commercial account executive', 'inside sales rep'
  ],
  keyword_signals = ARRAY[
    'smb', 'mid-market', 'inside sales', 'transactional sales',
    'high velocity', 'pipeline generation', 'demo', 'trial conversion',
    'quota attainment', 'cold calling'
  ],
  technology_signals = ARRAY[
    'salesforce', 'hubspot', 'outreach', 'salesloft',
    'gong', 'zoom info', 'apollo', 'linkedin'
  ]
WHERE specialty_normalized = 'smb_sales';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'sales engineer', 'solutions engineer', 'se',
    'presales engineer', 'technical sales engineer'
  ],
  keyword_signals = ARRAY[
    'sales engineering', 'solutions engineering', 'presales',
    'technical demo', 'proof of concept', 'poc', 'rfp response',
    'technical evaluation', 'customer discovery', 'solution architecture'
  ],
  technology_signals = ARRAY[
    'salesforce', 'demo tools', 'postman', 'github',
    'aws', 'gcp', 'sql', 'python', 'terraform'
  ]
WHERE specialty_normalized = 'sales_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'partnerships manager', 'partner manager', 'strategic partnerships',
    'business development manager', 'alliance manager', 'channel manager'
  ],
  keyword_signals = ARRAY[
    'partnerships', 'partner', 'alliance', 'channel',
    'strategic partnership', 'ecosystem', 'co-sell', 'integration partner',
    'technology partner', 'reseller', 'oem'
  ],
  technology_signals = ARRAY[
    'salesforce', 'hubspot', 'crossbeam', 'reveal',
    'partnerstack', 'notion', 'excel'
  ]
WHERE specialty_normalized = 'partnerships';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'sales executive', 'vp of sales', 'head of sales',
    'chief revenue officer', 'cro', 'sales director'
  ],
  keyword_signals = ARRAY[
    'sales leadership', 'revenue', 'quota', 'team building',
    'sales strategy', 'forecast', 'pipeline management',
    'territory planning', 'compensation plan', 'sales enablement'
  ],
  technology_signals = ARRAY[
    'salesforce', 'clari', 'gong', 'tableau',
    'excel', 'looker', 'hubspot'
  ]
WHERE specialty_normalized = 'sales_executive';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'account executive', 'ae', 'senior account executive',
    'named account executive', 'key account manager'
  ],
  keyword_signals = ARRAY[
    'account executive', 'closing', 'deal cycle', 'demo',
    'negotiation', 'proposal', 'pipeline', 'quota',
    'customer relationship', 'upsell', 'cross-sell'
  ],
  technology_signals = ARRAY[
    'salesforce', 'hubspot', 'gong', 'outreach',
    'salesloft', 'docusign', 'zoom', 'linkedin'
  ]
WHERE specialty_normalized = 'account_executive';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'business development representative', 'bdr', 'business development manager',
    'bd manager', 'strategic business development'
  ],
  keyword_signals = ARRAY[
    'business development', 'bd', 'new business', 'market expansion',
    'strategic deals', 'partnership development', 'ecosystem development',
    'market entry', 'channel development'
  ],
  technology_signals = ARRAY[
    'salesforce', 'hubspot', 'linkedin', 'outreach',
    'zoom info', 'apollo', 'notion'
  ]
WHERE specialty_normalized = 'business_development';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'solutions engineer', 'solutions architect', 'customer engineer',
    'implementation engineer', 'professional services engineer'
  ],
  keyword_signals = ARRAY[
    'solutions', 'solution architecture', 'implementation',
    'customer success engineering', 'technical onboarding',
    'integration', 'deployment', 'customer technical'
  ],
  technology_signals = ARRAY[
    'aws', 'gcp', 'azure', 'python', 'sql', 'rest api',
    'terraform', 'docker', 'salesforce', 'jira'
  ]
WHERE specialty_normalized = 'solutions_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'forward deployed engineer', 'fde', 'field engineer',
    'customer-embedded engineer', 'on-site engineer'
  ],
  keyword_signals = ARRAY[
    'forward deployed', 'field engineering', 'customer-site',
    'on-site', 'deployment', 'custom integration',
    'customer engineering', 'hands-on delivery'
  ],
  technology_signals = ARRAY[
    'python', 'sql', 'aws', 'docker', 'kubernetes',
    'typescript', 'react', 'java', 'go'
  ]
WHERE specialty_normalized = 'forward_deployed_engineering';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'federal sales', 'government sales', 'public sector sales',
    'federal account executive', 'govtech sales'
  ],
  keyword_signals = ARRAY[
    'federal', 'government', 'public sector', 'dod', 'dhs',
    'fedramp', 'ato', 'sbir', 'sttr', 'gsa schedule',
    'contracting officer', 'government procurement'
  ],
  technology_signals = ARRAY[
    'salesforce', 'sam.gov', 'govwin', 'deltek',
    'bloomberg government', 'excel'
  ]
WHERE specialty_normalized = 'federal_sales';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'defense sales', 'defense business development',
    'defense account manager', 'military sales'
  ],
  keyword_signals = ARRAY[
    'defense', 'military', 'dod', 'defense contractor',
    'prime contractor', 'subcontract', 'itar', 'classified',
    'program of record', 'defense budget', 'milspec'
  ],
  technology_signals = ARRAY[
    'salesforce', 'deltek', 'govwin', 'sam.gov',
    'excel', 'powerpoint'
  ]
WHERE specialty_normalized = 'defense_sales';

-- ============================================================
-- MARKETING
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'growth marketer', 'growth marketing manager', 'performance marketer',
    'paid acquisition manager', 'digital marketing manager'
  ],
  keyword_signals = ARRAY[
    'growth marketing', 'performance marketing', 'paid acquisition',
    'cac', 'roas', 'conversion optimization', 'funnel',
    'attribution', 'retargeting', 'paid social', 'paid search'
  ],
  technology_signals = ARRAY[
    'google ads', 'facebook ads', 'meta ads', 'linkedin ads',
    'google analytics', 'ga4', 'segment', 'amplitude', 'braze',
    'hubspot', 'marketo', 'mixpanel'
  ]
WHERE specialty_normalized = 'growth_marketing';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'content marketer', 'content marketing manager', 'content strategist',
    'editorial manager', 'seo manager'
  ],
  keyword_signals = ARRAY[
    'content marketing', 'content strategy', 'seo', 'editorial',
    'blog', 'thought leadership', 'content calendar', 'copywriting',
    'organic traffic', 'keyword research', 'backlinks'
  ],
  technology_signals = ARRAY[
    'wordpress', 'webflow', 'ahrefs', 'semrush', 'google search console',
    'google analytics', 'hubspot', 'marketo', 'mailchimp',
    'contentful', 'clearscope'
  ]
WHERE specialty_normalized = 'content_marketing';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'brand marketer', 'brand marketing manager', 'brand manager',
    'brand strategist', 'head of brand'
  ],
  keyword_signals = ARRAY[
    'brand marketing', 'brand strategy', 'brand awareness',
    'brand positioning', 'campaign', 'creative direction',
    'brand guidelines', 'brand voice', 'messaging'
  ],
  technology_signals = ARRAY[
    'adobe creative suite', 'figma', 'canva', 'hubspot',
    'sprout social', 'hootsuite', 'google analytics'
  ]
WHERE specialty_normalized = 'brand_marketing';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'product marketing manager', 'pmm', 'product marketer',
    'senior product marketing manager', 'head of product marketing'
  ],
  keyword_signals = ARRAY[
    'product marketing', 'positioning', 'messaging', 'competitive intelligence',
    'sales enablement', 'launch', 'go-to-market', 'gtm',
    'analyst relations', 'customer story', 'win/loss'
  ],
  technology_signals = ARRAY[
    'salesforce', 'hubspot', 'gong', 'crayon', 'klue',
    'pendo', 'amplitude', 'notion', 'figma'
  ]
WHERE specialty_normalized = 'product_marketing';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'demand generation manager', 'demand gen manager',
    'lead generation manager', 'marketing operations manager'
  ],
  keyword_signals = ARRAY[
    'demand generation', 'demand gen', 'lead generation', 'mql', 'sql',
    'marketing automation', 'email marketing', 'nurture campaign',
    'webinar', 'event marketing', 'pipeline contribution'
  ],
  technology_signals = ARRAY[
    'marketo', 'hubspot', 'pardot', 'salesforce', 'outreach',
    'mailchimp', 'sendgrid', 'zoom webinar', 'on24'
  ]
WHERE specialty_normalized = 'demand_generation';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'communications manager', 'corporate communications',
    'pr manager', 'public relations manager', 'comms manager',
    'head of communications'
  ],
  keyword_signals = ARRAY[
    'communications', 'public relations', 'pr', 'media relations',
    'press release', 'crisis communications', 'internal communications',
    'corporate messaging', 'spokesperson', 'media coverage'
  ],
  technology_signals = ARRAY[
    'cision', 'muck rack', 'meltwater', 'business wire',
    'pr newswire', 'slack', 'notion', 'google workspace'
  ]
WHERE specialty_normalized = 'communications';

-- ============================================================
-- RECRUITING
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'founding recruiter', 'first recruiter', 'head of recruiting',
    'founding talent partner', 'talent acquisition lead'
  ],
  keyword_signals = ARRAY[
    'founding recruiter', 'first recruiting hire', 'building recruiting function',
    'ats setup', 'employer brand', 'hiring process design',
    'recruiting infrastructure', 'sourcing strategy'
  ],
  technology_signals = ARRAY[
    'greenhouse', 'lever', 'ashby', 'linkedin recruiter',
    'gem', 'goodtime', 'notion', 'excel'
  ]
WHERE specialty_normalized = 'founding_recruiting';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'head of talent', 'head of recruiting', 'vp of talent',
    'director of talent acquisition', 'talent acquisition director'
  ],
  keyword_signals = ARRAY[
    'talent leadership', 'recruiting leadership', 'hiring strategy',
    'talent operations', 'recruiting team', 'headcount planning',
    'diversity hiring', 'employer brand', 'talent pipeline'
  ],
  technology_signals = ARRAY[
    'greenhouse', 'lever', 'ashby', 'workday', 'linkedin recruiter',
    'gem', 'tableau', 'excel'
  ]
WHERE specialty_normalized = 'head_of_talent';

-- ============================================================
-- FINANCE
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'finance manager', 'finance director', 'head of finance',
    'vp finance', 'controller', 'cfo'
  ],
  keyword_signals = ARRAY[
    'finance', 'financial management', 'budget', 'forecast',
    'financial planning', 'cash management', 'financial reporting',
    'gaap', 'month-end close', 'audit'
  ],
  technology_signals = ARRAY[
    'excel', 'netsuite', 'quickbooks', 'sap', 'oracle',
    'adaptive planning', 'anaplan', 'tableau', 'sql'
  ]
WHERE specialty_normalized = 'finance_general';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'accountant', 'senior accountant', 'staff accountant',
    'accounting manager', 'cpa'
  ],
  keyword_signals = ARRAY[
    'accounting', 'general ledger', 'accounts payable', 'accounts receivable',
    'reconciliation', 'journal entry', 'accrual', 'gaap',
    'ifrs', 'tax', 'audit', 'revenue recognition'
  ],
  technology_signals = ARRAY[
    'netsuite', 'quickbooks', 'sap', 'oracle', 'xero',
    'excel', 'sage', 'bill.com', 'expensify'
  ]
WHERE specialty_normalized = 'accounting';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'fp&a analyst', 'fp&a manager', 'financial planning analyst',
    'financial analyst', 'senior fp&a analyst'
  ],
  keyword_signals = ARRAY[
    'fp&a', 'financial planning', 'financial analysis', 'budgeting',
    'forecasting', 'variance analysis', 'financial model',
    'scenario planning', 'board deck', 'investor update'
  ],
  technology_signals = ARRAY[
    'excel', 'adaptive planning', 'anaplan', 'mosaic',
    'netsuite', 'tableau', 'sql', 'python'
  ]
WHERE specialty_normalized = 'fpa';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'treasurer', 'treasury analyst', 'treasury manager',
    'cash management analyst'
  ],
  keyword_signals = ARRAY[
    'treasury', 'cash management', 'liquidity', 'banking relationship',
    'foreign exchange', 'fx', 'debt management', 'capital markets',
    'investment', 'working capital'
  ],
  technology_signals = ARRAY[
    'bloomberg', 'kyriba', 'sap', 'excel',
    'swift', 'banking platform', 'netsuite'
  ]
WHERE specialty_normalized = 'treasury';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'investor relations manager', 'ir manager', 'investor relations director',
    'head of investor relations'
  ],
  keyword_signals = ARRAY[
    'investor relations', 'ir', 'earnings call', 'shareholder',
    'sec filing', '10-k', '10-q', 'analyst day',
    'investor presentation', 'guidance', 'proxy'
  ],
  technology_signals = ARRAY[
    'bloomberg', 'factset', 'excel', 'powerpoint',
    'q4', 'ipreo', 'sec edgar'
  ]
WHERE specialty_normalized = 'investor_relations';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'corporate development', 'corp dev', 'm&a analyst',
    'corporate development manager', 'head of corp dev'
  ],
  keyword_signals = ARRAY[
    'corporate development', 'mergers and acquisitions', 'm&a',
    'due diligence', 'deal sourcing', 'valuation', 'integration',
    'strategic acquisition', 'acqui-hire', 'investment thesis'
  ],
  technology_signals = ARRAY[
    'excel', 'pitchbook', 'capital iq', 'bloomberg',
    'powerpoint', 'dataroom', 'notion'
  ]
WHERE specialty_normalized = 'corporate_development';

-- ============================================================
-- LEGAL
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'general counsel', 'legal counsel', 'corporate counsel',
    'associate general counsel', 'senior counsel'
  ],
  keyword_signals = ARRAY[
    'legal counsel', 'corporate law', 'commercial contracts',
    'litigation', 'employment law', 'corporate governance',
    'board advisory', 'legal strategy', 'outside counsel management'
  ],
  technology_signals = ARRAY[
    'westlaw', 'lexisnexis', 'ironclad', 'docusign',
    'clio', 'contract express', 'excel'
  ]
WHERE specialty_normalized = 'legal_counsel';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'regulatory affairs manager', 'regulatory affairs specialist',
    'regulatory engineer', 'regulatory compliance manager'
  ],
  keyword_signals = ARRAY[
    'regulatory', 'fda', 'faa', 'easa', 'regulatory submission',
    'regulatory strategy', 'regulatory approval', 'clinical trial',
    'medical device', 'drug approval', 'pma', '510k'
  ],
  technology_signals = ARRAY[
    'veeva', 'mastercontrol', 'trackwise', 'excel',
    'sharepoint', 'jira', 'documentum'
  ]
WHERE specialty_normalized = 'regulatory_affairs';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ip counsel', 'ip attorney', 'patent counsel',
    'intellectual property lawyer', 'patent engineer'
  ],
  keyword_signals = ARRAY[
    'intellectual property', 'ip', 'patent', 'trademark',
    'trade secret', 'copyright', 'patent prosecution',
    'patent portfolio', 'freedom to operate', 'prior art'
  ],
  technology_signals = ARRAY[
    'patseer', 'google patents', 'lens.org', 'docketnavigator',
    'excel', 'word', 'westlaw'
  ]
WHERE specialty_normalized = 'ip_legal';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'contracts manager', 'contracts specialist', 'contract administrator',
    'commercial contracts manager', 'contracts analyst'
  ],
  keyword_signals = ARRAY[
    'contracts', 'contract negotiation', 'contract management',
    'nda', 'msa', 'sow', 'order form', 'sla',
    'terms and conditions', 'redline', 'contract lifecycle'
  ],
  technology_signals = ARRAY[
    'ironclad', 'docusign', 'icertis', 'agiloft',
    'concord', 'juro', 'excel', 'word'
  ]
WHERE specialty_normalized = 'contracts';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'compliance officer', 'compliance manager', 'compliance analyst',
    'compliance director', 'head of compliance'
  ],
  keyword_signals = ARRAY[
    'compliance', 'regulatory compliance', 'soc 2', 'iso 27001',
    'gdpr', 'hipaa', 'pci dss', 'audit', 'policy',
    'risk assessment', 'internal controls'
  ],
  technology_signals = ARRAY[
    'vanta', 'drata', 'secureframe', 'onspring',
    'archer', 'logicgate', 'excel', 'jira'
  ]
WHERE specialty_normalized = 'compliance';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'export compliance officer', 'itar compliance manager',
    'export control specialist', 'trade compliance manager'
  ],
  keyword_signals = ARRAY[
    'export compliance', 'itar', 'ear', 'export control',
    'trade compliance', 'deemed export', 'technology control plan',
    'tcp', 'ofac', 'sanctions', 'encryption export'
  ],
  technology_signals = ARRAY[
    'visual compliance', 'ocr solutions', 'sap gts',
    'excel', 'sharepoint', 'jira'
  ]
WHERE specialty_normalized = 'export_compliance';

-- ============================================================
-- FOUNDER
-- ============================================================

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'ceo', 'chief executive officer', 'ceo & co-founder',
    'ceo & founder', 'chief executive'
  ],
  keyword_signals = ARRAY[
    'ceo', 'chief executive', 'company leadership', 'fundraising',
    'board management', 'company strategy', 'vision', 'scaling',
    'culture', 'executive team', 'investor'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'ceo';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'founding engineer', 'first engineer', 'engineer #1',
    'founding software engineer', 'founding member - engineering'
  ],
  keyword_signals = ARRAY[
    'founding engineer', 'first engineer', 'employee #1',
    'built from scratch', 'zero to one', '0 to 1',
    'initial architecture', 'first hire'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'founding_engineer';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'co-founder', 'cofounder', 'co-founder & cto',
    'co-founder & ceo', 'co-founder & coo'
  ],
  keyword_signals = ARRAY[
    'co-founder', 'cofounder', 'co-founded', 'started the company',
    'founding team', 'bootstrapped', 'raised funding'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'co_founder';

UPDATE specialty_dictionary SET
  title_patterns = ARRAY[
    'founding team member', 'founding team', 'early employee',
    'founding member', 'employee #2', 'employee #3'
  ],
  keyword_signals = ARRAY[
    'founding team', 'early employee', 'founding member',
    'joined pre-seed', 'joined at founding', 'first ten employees'
  ],
  technology_signals = ARRAY[]::TEXT[]
WHERE specialty_normalized = 'founding_team_member';
