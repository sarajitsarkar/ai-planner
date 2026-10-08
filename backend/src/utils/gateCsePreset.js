// Default GATE CSE subject/chapter set used by the "Seed GATE CSE subjects"
// one-click action. Hours/importance/pyqWeightage are reasonable defaults
// based on typical GATE CSE weightage patterns — fully editable afterwards.

const chapter = (name, estimatedHours, importance, difficulty, pyqWeightage) => ({
  name,
  estimatedHours,
  importance,
  difficulty,
  pyqWeightage,
});

const GATE_CSE_SUBJECTS = [
  {
    name: 'Engineering Mathematics',
    priority: 4,
    difficulty: 3,
    weightage: 13,
    color: '#f59e0b',
    subtopics: [
      chapter('Linear Algebra', 8, 4, 3, 15),
      chapter('Calculus', 8, 4, 3, 15),
      chapter('Probability & Statistics', 8, 4, 3, 20),
      chapter('Discrete Mathematics', 10, 5, 4, 25),
    ],
  },
  {
    name: 'Digital Logic',
    priority: 3,
    difficulty: 3,
    weightage: 6,
    color: '#10b981',
    subtopics: [
      chapter('Number Systems', 4, 3, 2, 15),
      chapter('Boolean Algebra & Minimization', 6, 4, 3, 20),
      chapter('Combinational Circuits', 6, 4, 3, 25),
      chapter('Sequential Circuits', 8, 5, 4, 30),
    ],
  },
  {
    name: 'Computer Organization & Architecture',
    priority: 4,
    difficulty: 4,
    weightage: 9,
    color: '#3b82f6',
    subtopics: [
      chapter('Machine Instructions & Addressing Modes', 6, 4, 3, 15),
      chapter('ALU, Data-path & Control Unit', 8, 5, 4, 20),
      chapter('Memory Hierarchy & Cache', 8, 5, 4, 30),
      chapter('I/O Interface & Pipelining', 8, 4, 4, 25),
    ],
  },
  {
    name: 'Programming in C',
    priority: 3,
    difficulty: 2,
    weightage: 5,
    color: '#8b5cf6',
    subtopics: [
      chapter('Basics, Control Flow & Functions', 5, 3, 2, 20),
      chapter('Pointers & Arrays', 6, 4, 3, 30),
      chapter('Recursion', 5, 4, 3, 25),
      chapter('Structures & Dynamic Memory', 5, 3, 3, 25),
    ],
  },
  {
    name: 'Data Structures',
    priority: 5,
    difficulty: 4,
    weightage: 10,
    color: '#ef4444',
    subtopics: [
      chapter('Arrays, Stacks & Queues', 6, 4, 3, 15),
      chapter('Linked Lists', 5, 4, 3, 15),
      chapter('Trees & BST', 8, 5, 4, 25),
      chapter('Graphs', 8, 5, 4, 25),
      chapter('Hashing', 5, 4, 3, 20),
    ],
  },
  {
    name: 'Algorithms',
    priority: 5,
    difficulty: 5,
    weightage: 10,
    color: '#ec4899',
    subtopics: [
      chapter('Asymptotic Analysis', 4, 4, 3, 15),
      chapter('Sorting & Searching', 6, 4, 3, 20),
      chapter('Divide & Conquer', 6, 4, 4, 20),
      chapter('Greedy Algorithms', 6, 4, 4, 20),
      chapter('Dynamic Programming', 10, 5, 5, 30),
      chapter('Graph Algorithms', 8, 5, 4, 25),
    ],
  },
  {
    name: 'Operating Systems',
    priority: 5,
    difficulty: 4,
    weightage: 9,
    color: '#14b8a6',
    subtopics: [
      chapter('Process Management & Scheduling', 8, 5, 4, 25),
      chapter('Process Synchronization', 8, 5, 4, 25),
      chapter('Deadlocks', 5, 4, 3, 20),
      chapter('Memory Management & Paging', 8, 5, 4, 25),
      chapter('File Systems & I/O', 5, 3, 3, 15),
    ],
  },
  {
    name: 'Computer Networks',
    priority: 4,
    difficulty: 3,
    weightage: 8,
    color: '#0ea5e9',
    subtopics: [
      chapter('OSI & TCP/IP Models', 4, 3, 2, 15),
      chapter('Data Link Layer', 6, 4, 3, 20),
      chapter('Network Layer & Routing', 8, 5, 4, 25),
      chapter('Transport Layer (TCP/UDP)', 8, 5, 4, 25),
      chapter('Application Layer Protocols', 4, 3, 2, 15),
    ],
  },
  {
    name: 'Database Management Systems',
    priority: 5,
    difficulty: 3,
    weightage: 9,
    color: '#a855f7',
    subtopics: [
      chapter('ER Model & Relational Model', 6, 4, 3, 20),
      chapter('SQL', 6, 5, 3, 25),
      chapter('Normalization & Functional Dependencies', 8, 5, 4, 25),
      chapter('Transactions & Concurrency Control', 8, 4, 4, 20),
      chapter('Indexing & File Organization', 5, 3, 3, 10),
    ],
  },
  {
    name: 'Theory of Computation',
    priority: 4,
    difficulty: 4,
    weightage: 6,
    color: '#f97316',
    subtopics: [
      chapter('Finite Automata & Regular Languages', 6, 4, 3, 25),
      chapter('Context-Free Grammars & PDA', 6, 4, 4, 25),
      chapter('Turing Machines', 6, 4, 4, 25),
      chapter('Decidability & Undecidability', 5, 4, 4, 25),
    ],
  },
  {
    name: 'Compiler Design',
    priority: 3,
    difficulty: 4,
    weightage: 5,
    color: '#84cc16',
    subtopics: [
      chapter('Lexical Analysis', 4, 3, 3, 20),
      chapter('Syntax Analysis & Parsing', 6, 4, 4, 30),
      chapter('Syntax-Directed Translation', 5, 3, 4, 20),
      chapter('Code Optimization & Generation', 5, 3, 4, 30),
    ],
  },
  {
    name: 'Software Engineering',
    priority: 2,
    difficulty: 2,
    weightage: 3,
    color: '#64748b',
    subtopics: [
      chapter('SDLC Models', 3, 3, 2, 40),
      chapter('Software Design & Metrics', 3, 3, 2, 30),
      chapter('Testing Strategies', 3, 3, 2, 30),
    ],
  },
  {
    name: 'Web Technologies',
    priority: 1,
    difficulty: 2,
    weightage: 2,
    color: '#06b6d4',
    subtopics: [
      chapter('HTML/CSS Basics', 3, 2, 1, 30),
      chapter('JavaScript Fundamentals', 4, 3, 2, 30),
      chapter('HTTP, Client-Server Model', 3, 3, 2, 40),
    ],
  },
];

module.exports = { GATE_CSE_SUBJECTS };
