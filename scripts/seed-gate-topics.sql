-- =============================================================================
-- seed-gate-topics.sql
-- GATE 2027 official syllabus: CS, DA, and General Aptitude with subtopics.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- ── 1. Exam papers (idempotent) ───────────────────────────────────────────────

INSERT INTO public.exam_papers (code, label, description)
VALUES
  ('CS', 'Computer Science and Information Technology', 'GATE CS paper'),
  ('DA', 'Data Science and Artificial Intelligence',    'GATE DA paper')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Syllabus versions (CS and DA, year 2027) ──────────────────────────────

INSERT INTO public.syllabus_versions (paper_id, year, is_current, source_ref)
VALUES
  (
    (SELECT id FROM public.exam_papers WHERE code = 'CS'),
    2027, true,
    'GATE 2027 official syllabus'
  ),
  (
    (SELECT id FROM public.exam_papers WHERE code = 'DA'),
    2027, true,
    'GATE 2027 official syllabus'
  )
ON CONFLICT (paper_id, year) DO UPDATE SET is_current = true;

-- ── 3. Subjects ───────────────────────────────────────────────────────────────

INSERT INTO public.subjects (name, is_general_aptitude, display_order)
VALUES
  ('Engineering Mathematics',                     false,  10),
  ('Digital Logic',                               false,  30),
  ('Computer Organization and Architecture',      false,  40),
  ('Programming and Data Structures',             false,  50),
  ('Algorithms',                                  false,  60),
  ('Theory of Computation',                       false,  70),
  ('Compiler Design',                             false,  80),
  ('Operating Systems',                           false,  90),
  ('Database Management Systems',                 false, 100),
  ('Computer Networks',                           false, 110),
  ('Probability and Statistics',                  false, 120),
  ('Linear Algebra',                              false, 130),
  ('Calculus and Optimization',                   false, 140),
  ('Programming, Data Structures and Algorithms', false, 150),
  ('Database Management and Warehousing',         false, 160),
  ('Machine Learning',                            false, 170),
  ('Artificial Intelligence',                     false, 180),
  ('General Aptitude',                            true,  200)
ON CONFLICT (name) DO NOTHING;

-- ── 4. Syllabus–subject links ─────────────────────────────────────────────────

-- CS 2027 subjects
INSERT INTO public.syllabus_subjects (syllabus_version_id, subject_id, display_order)
SELECT
  (SELECT sv.id
   FROM public.syllabus_versions sv
   JOIN public.exam_papers ep ON ep.id = sv.paper_id
   WHERE ep.code = 'CS' AND sv.year = 2027),
  s.id,
  s.display_order
FROM public.subjects s
WHERE s.name IN (
  'Engineering Mathematics',
  'Digital Logic',
  'Computer Organization and Architecture',
  'Programming and Data Structures',
  'Algorithms',
  'Theory of Computation',
  'Compiler Design',
  'Operating Systems',
  'Database Management Systems',
  'Computer Networks',
  'General Aptitude'
)
ON CONFLICT DO NOTHING;

-- DA 2027 subjects
INSERT INTO public.syllabus_subjects (syllabus_version_id, subject_id, display_order)
SELECT
  (SELECT sv.id
   FROM public.syllabus_versions sv
   JOIN public.exam_papers ep ON ep.id = sv.paper_id
   WHERE ep.code = 'DA' AND sv.year = 2027),
  s.id,
  s.display_order
FROM public.subjects s
WHERE s.name IN (
  'Probability and Statistics',
  'Linear Algebra',
  'Calculus and Optimization',
  'Programming, Data Structures and Algorithms',
  'Database Management and Warehousing',
  'Machine Learning',
  'Artificial Intelligence',
  'General Aptitude'
)
ON CONFLICT DO NOTHING;

-- ── 5. Topics ─────────────────────────────────────────────────────────────────

-- Engineering Mathematics (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Engineering Mathematics'), t.name, t.ord
FROM (VALUES
  (1,  'Propositional and First Order Logic'),
  (2,  'Sets, Relations and Functions'),
  (3,  'Partial Orders and Lattices'),
  (4,  'Monoids and Groups'),
  (5,  'Graphs: Connectivity, Matching, Coloring'),
  (6,  'Combinatorics: Counting, Recurrences, Generating Functions'),
  (7,  'Linear Algebra: Matrices, Determinants, System of Linear Equations, Eigenvalues, LU Decomposition'),
  (8,  'Calculus: Limits, Continuity, Differentiability, Mean Value Theorem, Integration'),
  (9,  'Probability and Statistics: Random Variables, Uniform, Normal, Exponential, Poisson, Binomial Distributions, Conditional Probability, Bayes Theorem, Mean, Median, Mode, Standard Deviation, Correlation')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Digital Logic (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Digital Logic'), t.name, t.ord
FROM (VALUES
  (1, 'Boolean Algebra and Minimization'),
  (2, 'Karnaugh Maps'),
  (3, 'Combinational Circuits: Adders, Multiplexers, Encoders, Decoders'),
  (4, 'Sequential Circuits: Latches, Flip-Flops, Counters, Shift Registers'),
  (5, 'Number Representations: Binary, Octal, Hexadecimal, BCD, 2s Complement'),
  (6, 'Logic Families and Gates')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Computer Organization and Architecture (GATE CS 2027)
-- NOTE: Secondary storage / magnetic disk removed from GATE 2027.
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Computer Organization and Architecture'), t.name, t.ord
FROM (VALUES
  (1, 'Machine Instructions and Addressing Modes'),
  (2, 'ALU Design and Data Path'),
  (3, 'Control Unit Design: Hardwired and Microprogrammed'),
  (4, 'Instruction Pipelining: Hazards, Stalls, Forwarding'),
  (5, 'Memory Hierarchy: Cache (Direct, Associative, Set-Associative), Virtual Memory, TLB, Paging, Segmentation'),
  (6, 'I/O Interface: Interrupts, DMA, Polling')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Programming and Data Structures (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Programming and Data Structures'), t.name, t.ord
FROM (VALUES
  (1, 'Programming in C: Pointers, Structures, Functions, Recursion'),
  (2, 'Arrays and Strings'),
  (3, 'Stacks and Queues'),
  (4, 'Linked Lists: Singly, Doubly, Circular'),
  (5, 'Trees: Binary Trees, Binary Search Trees, AVL Trees, B-Trees'),
  (6, 'Binary Heaps: Min-Heap, Max-Heap, Heapify'),
  (7, 'Graphs: Representation, BFS, DFS')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Algorithms (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Algorithms'), t.name, t.ord
FROM (VALUES
  (1, 'Asymptotic Analysis: Big-O, Omega, Theta Notation'),
  (2, 'Searching: Linear Search, Binary Search'),
  (3, 'Sorting: Bubble, Selection, Insertion, Merge, Quick, Heap Sort'),
  (4, 'Hashing: Hash Functions, Collision Resolution'),
  (5, 'Divide and Conquer: Merge Sort, Quick Sort, Strassen''s Matrix'),
  (6, 'Greedy Algorithms: Activity Selection, Huffman Coding, Fractional Knapsack'),
  (7, 'Dynamic Programming: 0/1 Knapsack, LCS, LIS, Matrix Chain Multiplication'),
  (8, 'Graph Algorithms: BFS, DFS, Dijkstra, Bellman-Ford, Floyd-Warshall, Prim, Kruskal'),
  (9, 'Complexity Classes: P, NP, NP-Complete, NP-Hard')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Theory of Computation (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Theory of Computation'), t.name, t.ord
FROM (VALUES
  (1, 'Regular Languages and Finite Automata: DFA, NFA, Epsilon-NFA'),
  (2, 'Regular Expressions and Regular Grammars'),
  (3, 'Pumping Lemma for Regular Languages'),
  (4, 'Context-Free Grammars and Push-Down Automata'),
  (5, 'Pumping Lemma for CFLs'),
  (6, 'Chomsky Normal Form and CYK Algorithm'),
  (7, 'Turing Machines: Deterministic and Non-Deterministic'),
  (8, 'Decidability and Undecidability'),
  (9, 'Halting Problem and Reductions')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Compiler Design (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Compiler Design'), t.name, t.ord
FROM (VALUES
  (1, 'Lexical Analysis: Tokens, Patterns, Lexemes, Finite Automata'),
  (2, 'Parsing: Top-Down (LL), Bottom-Up (LR, SLR, LALR)'),
  (3, 'Syntax-Directed Translation: Inherited and Synthesized Attributes'),
  (4, 'Intermediate Code Generation: Three Address Code, Quadruples'),
  (5, 'Runtime Environments: Activation Records, Stack Frames'),
  (6, 'Code Optimization: Constant Folding, Dead Code Elimination, Loop Optimization'),
  (7, 'Code Generation: Register Allocation')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Operating Systems (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Operating Systems'), t.name, t.ord
FROM (VALUES
  (1,  'System Calls and OS Structure'),
  (2,  'Processes: Creation, States, PCB'),
  (3,  'Threads and Multithreading Models'),
  (4,  'Inter-Process Communication: Pipes, Message Queues, Shared Memory'),
  (5,  'CPU Scheduling: FCFS, SJF, Round Robin, Priority, Multilevel Queue'),
  (6,  'Process Synchronization: Critical Section, Mutex, Semaphores, Monitors'),
  (7,  'Deadlock: Conditions, Prevention, Avoidance (Banker''s Algorithm), Detection, Recovery'),
  (8,  'Memory Management: Contiguous Allocation, Paging, Segmentation'),
  (9,  'Virtual Memory: Page Replacement Algorithms (FIFO, LRU, Optimal), Thrashing'),
  (10, 'File Systems: Allocation Methods, Directory Structure, Inodes, FAT')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Database Management Systems (GATE CS 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Database Management Systems'), t.name, t.ord
FROM (VALUES
  (1,  'ER Model: Entities, Attributes, Relationships, Keys'),
  (2,  'Relational Model: Domains, Tuples, Relations, Keys'),
  (3,  'Relational Algebra: Select, Project, Join, Union, Difference'),
  (4,  'Tuple Relational Calculus'),
  (5,  'SQL: DDL, DML, Joins, Aggregation, Subqueries, Views, Triggers'),
  (6,  'Integrity Constraints: Primary Key, Foreign Key, Check, Unique'),
  (7,  'Normal Forms: 1NF, 2NF, 3NF, BCNF, Lossless Decomposition'),
  (8,  'File Organization: Heap, Sequential, Hash'),
  (9,  'Indexing: B-Tree, B+ Tree, Dense, Sparse'),
  (10, 'Transaction Management: ACID Properties, Serializability, Conflict Serializability'),
  (11, 'Concurrency Control: 2-Phase Locking, Timestamp Ordering')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Computer Networks (GATE CS 2027)
-- NOTE: ARP, ICMP, DHCP, SMTP, FTP, UDP removed from GATE 2027.
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Computer Networks'), t.name, t.ord
FROM (VALUES
  (1, 'Layered Architecture: OSI and TCP/IP Models'),
  (2, 'LAN Technologies: Ethernet, CSMA/CD, Token Ring'),
  (3, 'Data Link Layer: Framing, Error Detection (CRC, Checksum), Flow Control (Stop-and-Wait, Sliding Window)'),
  (4, 'MAC Protocols: ALOHA, CSMA, 802.11 WiFi'),
  (5, 'IP Addressing: IPv4, Subnetting, CIDR, IPv6'),
  (6, 'Routing Algorithms: Distance Vector (Bellman-Ford), Link State (Dijkstra), OSPF, BGP'),
  (7, 'Transport Layer: TCP (3-way handshake, flow control, congestion control), Sockets'),
  (8, 'Application Layer: DNS, HTTP, HTTPS')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Probability and Statistics (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Probability and Statistics'), t.name, t.ord
FROM (VALUES
  (1,  'Permutations and Combinations'),
  (2,  'Probability Axioms, Sample Space, Events'),
  (3,  'Independent and Mutually Exclusive Events'),
  (4,  'Marginal, Conditional and Joint Probability'),
  (5,  'Bayes Theorem'),
  (6,  'Random Variables: Discrete and Continuous'),
  (7,  'Probability Distributions: Bernoulli, Binomial, Uniform, Exponential, Poisson, Normal'),
  (8,  't-distribution and Chi-Squared Distribution'),
  (9,  'Mean, Median, Mode, Variance, Standard Deviation'),
  (10, 'Covariance and Correlation'),
  (11, 'Central Limit Theorem'),
  (12, 'Confidence Intervals'),
  (13, 'Hypothesis Testing: z-test, t-test, Chi-squared test')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Linear Algebra (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Linear Algebra'), t.name, t.ord
FROM (VALUES
  (1,  'Vector Spaces and Subspaces'),
  (2,  'Linear Dependence and Independence'),
  (3,  'Matrices: Types, Properties, Operations'),
  (4,  'Projection, Orthogonal and Idempotent Matrices'),
  (5,  'Systems of Linear Equations and Gaussian Elimination'),
  (6,  'Eigenvalues and Eigenvectors'),
  (7,  'Determinant, Rank, Nullity'),
  (8,  'LU Decomposition'),
  (9,  'Singular Value Decomposition (SVD)'),
  (10, 'Quadratic Forms')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Calculus and Optimization (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Calculus and Optimization'), t.name, t.ord
FROM (VALUES
  (1, 'Functions of a Single Variable'),
  (2, 'Limits, Continuity, Differentiability'),
  (3, 'Taylor Series'),
  (4, 'Maxima and Minima'),
  (5, 'Optimization Involving a Single Variable'),
  (6, 'Convex Functions'),
  (7, 'Gradient Descent Methods')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Programming, Data Structures and Algorithms (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Programming, Data Structures and Algorithms'), t.name, t.ord
FROM (VALUES
  (1,  'Python Programming: Variables, Loops, Functions, Arrays, Recursion'),
  (2,  'Stacks and Queues'),
  (3,  'Linked Lists'),
  (4,  'Trees and Binary Search Trees'),
  (5,  'Hash Tables and Heaps'),
  (6,  'Linear Search and Binary Search'),
  (7,  'Sorting: Selection, Bubble, Insertion, Merge, Quick Sort'),
  (8,  'Introduction to Graph Theory'),
  (9,  'Graph Traversal: BFS, DFS'),
  (10, 'Shortest Path Algorithms')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Database Management and Warehousing (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Database Management and Warehousing'), t.name, t.ord
FROM (VALUES
  (1,  'ER Model and Relational Model'),
  (2,  'Relational Algebra and Tuple Calculus'),
  (3,  'SQL and Integrity Constraints'),
  (4,  'Normal Forms and Functional Dependencies'),
  (5,  'File Organization and Indexing'),
  (6,  'Data Types, Data Normalization, Discretization'),
  (7,  'Sampling and Compression'),
  (8,  'Data Warehouse Modelling'),
  (9,  'Multidimensional Schema: Star, Snowflake'),
  (10, 'Concept Hierarchies, Measures and Categorization')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Machine Learning (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Machine Learning'), t.name, t.ord
FROM (VALUES
  (1,  'Simple and Multiple Linear Regression'),
  (2,  'Ridge Regression and Logistic Regression'),
  (3,  'k-Nearest Neighbour (kNN)'),
  (4,  'Naive Bayes Classifier'),
  (5,  'Linear Discriminant Analysis'),
  (6,  'Support Vector Machine (SVM)'),
  (7,  'Decision Trees'),
  (8,  'Bias-Variance Trade-off'),
  (9,  'k-Fold and LOO Cross-Validation'),
  (10, 'Multi-Layer Perceptron and Feed-Forward Neural Networks'),
  (11, 'k-Means and k-Medoid Clustering'),
  (12, 'Hierarchical Clustering: Single-Linkage, Complete-Linkage'),
  (13, 'Principal Component Analysis (PCA)'),
  (14, 'Precision, Recall, Accuracy, F1 Score, ROC Curve')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- Artificial Intelligence (GATE DA 2027)
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'Artificial Intelligence'), t.name, t.ord
FROM (VALUES
  (1, 'Uninformed Search: BFS, DFS, Uniform Cost Search'),
  (2, 'Informed Search: Greedy Best-First, A* Algorithm'),
  (3, 'Adversarial Search: Minimax, Alpha-Beta Pruning'),
  (4, 'Propositional Logic: Syntax, Semantics, Resolution'),
  (5, 'Predicate Logic: First-Order Logic, Unification'),
  (6, 'Reasoning Under Uncertainty'),
  (7, 'Bayesian Networks and Conditional Independence'),
  (8, 'Variable Elimination for Exact Inference'),
  (9, 'Approximate Inference through Sampling')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;

-- General Aptitude — Verbal Ability
INSERT INTO public.topics (subject_id, name, display_order)
SELECT (SELECT id FROM public.subjects WHERE name = 'General Aptitude'), t.name, t.ord
FROM (VALUES
  (1,  'English Grammar and Usage'),
  (2,  'Vocabulary and Word Meanings'),
  (3,  'Sentence Completion and Correction'),
  (4,  'Reading Comprehension'),
  (5,  'Verbal Analogies and Word Groups'),
  (6,  'Critical Reasoning'),
  (7,  'Verbal Deduction'),
  (8,  'Number Systems and Arithmetic'),
  (9,  'Percentage, Profit and Loss, Ratio and Proportion'),
  (10, 'Time, Speed and Distance'),
  (11, 'Time and Work'),
  (12, 'Simple and Compound Interest'),
  (13, 'Mensuration: Areas and Volumes'),
  (14, 'Data Interpretation: Tables, Bar Graphs, Pie Charts, Line Graphs'),
  (15, 'Numerical Reasoning and Series'),
  (16, 'Permutations and Combinations'),
  (17, 'Probability Basics')
) AS t(ord, name)
ON CONFLICT (subject_id, name) DO NOTHING;
