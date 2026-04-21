import type { CurriculumRow, ProblemRecord } from "./types";

interface ClassicContent {
  title: string;
  description: string;
  examples: Array<{ input: string; output: string; explanation: string }>;
  hints: string[];
  complexity: string;
}

const CLASSIC_MAP: Record<string, ClassicContent> = {
  "two-sum": {
    title: "Two Sum",
    description: "Given an integer array and a target, return indices of the two numbers whose sum equals target.",
    examples: [{ input: "nums=[2,7,11,15], target=9", output: "[0,1]", explanation: "2+7=9" }],
    hints: ["Think about complements.", "Store what you've seen so far.", "Hash map gives O(1) lookups."],
    complexity: "O(n) time, O(n) space.",
  },
  "valid-palindrome": {
    title: "Valid Palindrome",
    description: "Determine if a string is a palindrome after lowercasing and removing non-alphanumeric characters.",
    examples: [{ input: "A man, a plan, a canal: Panama", output: "true", explanation: "Normalized string is palindrome." }],
    hints: ["Two pointers from ends.", "Skip non-alphanumeric chars.", "Compare lowercase chars."],
    complexity: "O(n) time, O(1) extra space.",
  },
  "running-sum": {
    title: "Running Sum of 1D Array",
    description: "Return running sum where output[i] = sum(nums[0..i]).",
    examples: [{ input: "[1,2,3,4]", output: "[1,3,6,10]", explanation: "Prefix accumulation." }],
    hints: ["Each answer depends on previous sum.", "Maintain cumulative variable.", "Single pass is enough."],
    complexity: "O(n) time, O(1) extra space.",
  },
  "longest-unique-substring": {
    title: "Longest Substring Without Repeating Characters",
    description: "Find length of the longest substring without repeating characters.",
    examples: [{ input: "\"abcabcbb\"", output: "3", explanation: "Longest unique substring is \"abc\"." }],
    hints: ["Use sliding window boundaries.", "Track last seen index.", "Move left boundary on duplicates."],
    complexity: "O(n) time, O(min(n,charset)) space.",
  },
  "valid-anagram": {
    title: "Valid Anagram",
    description: "Given two strings, check if one is an anagram of the other.",
    examples: [{ input: "s=anagram, t=nagaram", output: "true", explanation: "Same character counts." }],
    hints: ["Character frequencies matter.", "Compare count maps/arrays.", "Early return on length mismatch."],
    complexity: "O(n) time, O(1) or O(k) space.",
  },
  "valid-parentheses": {
    title: "Valid Parentheses",
    description: "Given a string of brackets, determine if it is valid.",
    examples: [{ input: "\"()[]{}\"", output: "true", explanation: "All bracket pairs close correctly." }],
    hints: ["Stack tracks open brackets.", "Map closing to opening.", "Stack must be empty at end."],
    complexity: "O(n) time, O(n) space.",
  },
  "binary-search": {
    title: "Binary Search",
    description: "Given sorted array and target, return its index or -1.",
    examples: [{ input: "nums=[-1,0,3,5,9,12], target=9", output: "4", explanation: "Target found at index 4." }],
    hints: ["Use low/high boundaries.", "Mid decides half to discard.", "Avoid overflow in mid calc."],
    complexity: "O(log n) time, O(1) space.",
  },
  "reverse-linked-list": {
    title: "Reverse Linked List",
    description: "Reverse a singly linked list and return new head.",
    examples: [{ input: "1->2->3->4->5", output: "5->4->3->2->1", explanation: "Pointers reversed iteratively." }],
    hints: ["Keep prev/curr/next pointers.", "Rewire curr.next to prev.", "Advance all pointers safely."],
    complexity: "O(n) time, O(1) space.",
  },
  "max-depth-binary-tree": {
    title: "Maximum Depth of Binary Tree",
    description: "Return maximum depth of a binary tree.",
    examples: [{ input: "root=[3,9,20,null,null,15,7]", output: "3", explanation: "Longest root-to-leaf path length is 3." }],
    hints: ["Depth is 1 + max(left,right).", "Base case for null node.", "DFS recursion fits naturally."],
    complexity: "O(n) time, O(h) stack space.",
  },
  "kth-largest-element": {
    title: "Kth Largest Element in an Array",
    description: "Find the kth largest element in an unsorted array.",
    examples: [{ input: "nums=[3,2,1,5,6,4], k=2", output: "5", explanation: "2nd largest is 5." }],
    hints: ["A min-heap of size k works.", "Discard small values.", "Top of heap is answer."],
    complexity: "O(n log k) time, O(k) space.",
  },
  "number-of-islands": {
    title: "Number of Islands",
    description: "Given a 2D grid of 1s and 0s, count connected components of land.",
    examples: [{ input: "grid=[[1,1,0],[1,0,0],[0,0,1]]", output: "2", explanation: "Two disconnected islands." }],
    hints: ["Traverse every cell.", "When land found, flood-fill it.", "Mark visited to avoid recounting."],
    complexity: "O(m*n) time, O(m*n) worst-case space.",
  },
  "climbing-stairs": {
    title: "Climbing Stairs",
    description: "Each move can climb 1 or 2 steps. Count distinct ways to reach step n.",
    examples: [{ input: "n=5", output: "8", explanation: "Fibonacci-like recurrence." }],
    hints: ["ways[n]=ways[n-1]+ways[n-2].", "Base cases for n=1 and n=2.", "Iterative DP is enough."],
    complexity: "O(n) time, O(1) space.",
  },
};

export function classicProblemFromCurriculum(
  row: CurriculumRow,
): ProblemRecord {
  const slug = row.source.replace("classic:", "");
  const content = CLASSIC_MAP[slug];
  const title =
    content?.title ??
    slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

  return {
    id: row.day,
    slug,
    day_number: row.day,
    title,
    description:
      content?.description ??
      `Solve the ${title} problem using a ${row.pattern} approach. Provide the most efficient time and space complexity you can justify.`,
    difficulty: row.difficulty,
    pattern: row.pattern,
    topic: row.topic,
    examples_json: JSON.stringify(content?.examples ?? []),
    key_insight: "Identify the invariant and preserve it as you scan the input.",
    applications_json: JSON.stringify([
      "Interview-style coding rounds",
      "Streaming and batching workflows",
      "Backend services handling large input sets",
    ]),
    variations_json: JSON.stringify([
      { title: `${title} II`, one_liner: "Harder constraints or an extra condition." },
      { title: `${title} with updates`, one_liner: "Input can change over time." },
    ]),
    why_it_matters: "This pattern appears frequently in interviews and production data-processing code where performance matters.",
    canonical_approach: "Start by defining the invariant for each step. Then move pointers or state transitions while preserving correctness and minimizing repeated work.",
    canonical_solutions_json: JSON.stringify({
      python: "def solve(data):\n    # TODO: implement\n    return data\n",
      go: "package main\n\nfunc Solve(data []int) []int {\n\t// TODO: implement\n\treturn data\n}\n",
      rust: "fn solve(data: Vec<i32>) -> Vec<i32> {\n    // TODO: implement\n    data\n}\n",
    }),
    hints_json: JSON.stringify(
      content?.hints ?? [
        "What state can you reuse from the previous step?",
        "Can you avoid nested loops by tracking a structure as you iterate?",
        "Write the condition that makes the current window/state valid.",
      ],
    ),
    complexity: content?.complexity ?? "Target O(n) time and O(n) or better space.",
    test_cases_json: JSON.stringify({
      python: [{ stdin: "", expected_stdout: "" }],
      go: [{ stdin: "", expected_stdout: "" }],
      rust: [{ stdin: "", expected_stdout: "" }],
    }),
    license: "self-written-cc0",
    source_url: `https://example.local/classics/${slug}`,
  };
}
