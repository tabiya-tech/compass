"""
Baseline Metrics Collector for E2E Tests

Captures metrics during conversation execution for baseline analysis:
- Turn count, conversation time (total + by phase + by agent)
- LLM calls count and duration
- Experiences discovered/explored, skills per experience
- Repetition rate (semantic similarity > 0.75)
- Phrase repetition (starter phrases like "Okay", "Got it" overuse)
- Question quality (achievement-focused vs routine task questions)
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import re
from pathlib import Path


@dataclass
class LLMCallMetrics:
    """Metrics for a single LLM call."""
    agent_type: str
    phase: str
    duration_sec: float
    prompt_tokens: int
    response_tokens: int
    timestamp: str


@dataclass
class PhaseMetrics:
    """Metrics aggregated by conversation phase."""
    phase_name: str
    turn_count: int = 0
    duration_sec: float = 0.0
    llm_calls: int = 0


@dataclass
class AgentMetrics:
    """Metrics aggregated by agent type."""
    agent_type: str
    turn_count: int = 0
    duration_sec: float = 0.0
    llm_calls: int = 0


@dataclass
class ExperienceMetrics:
    """Metrics for discovered/explored experiences."""
    experiences_discovered: int = 0
    experiences_explored: int = 0
    total_skills: int = 0
    skills_per_experience: List[int] = field(default_factory=list)
    avg_skills_per_experience: float = 0.0


@dataclass
class RepetitionMetrics:
    """Metrics for question repetition analysis."""
    agent_questions: List[str] = field(default_factory=list)
    repetition_count: int = 0
    repetition_rate: float = 0.0
    similar_question_pairs: List[tuple] = field(default_factory=list)


@dataclass
class PhraseRepetitionMetrics:
    """
    Metrics for detecting repetitive conversational patterns.
    
    Measures stylistic repetition like starting every message with "Okay" or "Got it"
    which can make conversations feel robotic even when questions are semantically different.
    """
    # Starter phrase analysis
    starter_phrase_counts: Dict[str, int] = field(default_factory=dict)
    starter_diversity_score: float = 0.0  # Unique starters / total questions (higher = better)
    most_common_starter: Optional[str] = None
    most_common_starter_count: int = 0
    top_starter_repetition_rate: float = 0.0  # % using top 3 starters (lower = more natural)
    
    # Questions that don't start with tracked phrases
    neutral_start_count: int = 0


@dataclass
class QuestionQualityMetrics:
    """
    Metrics for evaluating question quality and achievement focus.
    
    Measures whether the agent asks questions that elicit meaningful differentiation
    between candidates - focusing on achievements, challenges overcome, and growth
    rather than just routine task descriptions.
    """
    total_questions_analyzed: int = 0
    
    # Question type counts
    achievement_question_count: int = 0  # Questions about accomplishments, pride, growth
    routine_task_question_count: int = 0  # Questions about typical day/tasks
    factual_question_count: int = 0  # Questions about facts (dates, names, etc.)
    other_question_count: int = 0
    
    # Rates (as percentages)
    achievement_question_rate: float = 0.0  # Target: increase this
    routine_task_rate: float = 0.0
    
    # Example questions for review
    achievement_question_examples: List[str] = field(default_factory=list)
    routine_task_examples: List[str] = field(default_factory=list)


@dataclass
class BaselineMetrics:
    """Complete baseline metrics for a single conversation."""
    test_case_name: str
    session_id: str
    started_at: str
    completed_at: Optional[str] = None
    
    # Core metrics
    total_turn_count: int = 0
    total_conversation_time_sec: float = 0.0
    total_llm_calls: int = 0
    
    # Detailed breakdowns
    phase_metrics: Dict[str, PhaseMetrics] = field(default_factory=dict)
    agent_metrics: Dict[str, AgentMetrics] = field(default_factory=dict)
    experience_metrics: ExperienceMetrics = field(default_factory=ExperienceMetrics)
    repetition_metrics: RepetitionMetrics = field(default_factory=RepetitionMetrics)
    phrase_repetition_metrics: PhraseRepetitionMetrics = field(default_factory=PhraseRepetitionMetrics)
    question_quality_metrics: QuestionQualityMetrics = field(default_factory=QuestionQualityMetrics)
    
    # LLM call history
    llm_calls: List[LLMCallMetrics] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)
    
    def save(self, output_path: Path):
        """Save metrics to JSON file."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(self.to_json())


class BaselineMetricsCollector:
    """
    Collects baseline metrics during E2E test execution.
    
    Usage:
        collector = BaselineMetricsCollector(test_case_name, session_id)
        
        # During conversation
        collector.record_turn(phase, agent_type)
        collector.record_llm_call(agent_type, phase, duration, tokens)
        collector.record_agent_question(question_text)
        
        # At end
        collector.record_experiences(discovered, explored, skills_data)
        collector.calculate_repetition_rate()
        collector.finalize()
        
        # Export
        collector.save_metrics(output_folder)
    """
    
    def __init__(self, test_case_name: str, session_id: str):
        self.metrics = BaselineMetrics(
            test_case_name=test_case_name,
            session_id=session_id,
            started_at=datetime.utcnow().isoformat()
        )
        self._current_phase: Optional[str] = None
        self._turn_start_time: Optional[float] = None
    
    def record_turn(self, phase: str, agent_type: str):
        """Record a conversation turn."""
        self.metrics.total_turn_count += 1
        self._current_phase = phase
        
        # Update phase metrics
        if phase not in self.metrics.phase_metrics:
            self.metrics.phase_metrics[phase] = PhaseMetrics(phase_name=phase)
        self.metrics.phase_metrics[phase].turn_count += 1
        
        # Update agent metrics
        if agent_type not in self.metrics.agent_metrics:
            self.metrics.agent_metrics[agent_type] = AgentMetrics(agent_type=agent_type)
        self.metrics.agent_metrics[agent_type].turn_count += 1
    
    def record_llm_call(
        self,
        agent_type: str,
        phase: str,
        duration_sec: float,
        prompt_tokens: int = 0,
        response_tokens: int = 0
    ):
        """Record an LLM call."""
        call = LLMCallMetrics(
            agent_type=agent_type,
            phase=phase,
            duration_sec=duration_sec,
            prompt_tokens=prompt_tokens,
            response_tokens=response_tokens,
            timestamp=datetime.utcnow().isoformat()
        )
        
        self.metrics.llm_calls.append(call)
        self.metrics.total_llm_calls += 1
        self.metrics.total_conversation_time_sec += duration_sec
        
        # Update phase metrics
        if phase in self.metrics.phase_metrics:
            self.metrics.phase_metrics[phase].duration_sec += duration_sec
            self.metrics.phase_metrics[phase].llm_calls += 1
        
        # Update agent metrics
        if agent_type in self.metrics.agent_metrics:
            self.metrics.agent_metrics[agent_type].duration_sec += duration_sec
            self.metrics.agent_metrics[agent_type].llm_calls += 1
    
    def record_agent_question(self, question_text: str):
        """Record an agent question for repetition analysis."""
        if question_text and len(question_text.strip()) > 0:
            self.metrics.repetition_metrics.agent_questions.append(question_text.strip())
    
    def record_experiences(
        self,
        experiences_discovered: int,
        experiences_explored: int,
        skills_data: List[int]
    ):
        """
        Record experience and skills metrics.
        
        Args:
            experiences_discovered: Total experiences found
            experiences_explored: Experiences fully explored
            skills_data: List of skill counts per experience
        """
        self.metrics.experience_metrics.experiences_discovered = experiences_discovered
        self.metrics.experience_metrics.experiences_explored = experiences_explored
        self.metrics.experience_metrics.skills_per_experience = skills_data
        self.metrics.experience_metrics.total_skills = sum(skills_data)
        
        if len(skills_data) > 0:
            self.metrics.experience_metrics.avg_skills_per_experience = (
                sum(skills_data) / len(skills_data)
            )
    
    def calculate_repetition_rate(self, similarity_threshold: float = 0.75):
        """
        Calculate repetition rate using semantic similarity.
        
        For now, uses simple string matching. Can be enhanced with embeddings.
        """
        questions = self.metrics.repetition_metrics.agent_questions
        repetition_count = 0
        similar_pairs = []
        
        if len(questions) < 2:
            return
        
        # Simple implementation: check for very similar questions
        # TODO: Replace with semantic similarity using embeddings
        for i, q1 in enumerate(questions):
            for j, q2 in enumerate(questions[i+1:], start=i+1):
                # Simple similarity: normalized Levenshtein distance
                similarity = self._simple_similarity(q1, q2)
                
                if similarity > similarity_threshold:
                    repetition_count += 1
                    similar_pairs.append((i, j, similarity))
        
        self.metrics.repetition_metrics.repetition_count = repetition_count
        self.metrics.repetition_metrics.similar_question_pairs = similar_pairs
        
        # Calculate rate
        if len(questions) > 0:
            self.metrics.repetition_metrics.repetition_rate = (
                repetition_count / len(questions)
            )
    
    def _simple_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate simple similarity between two strings.
        
        Uses Jaccard similarity of word sets as a quick approximation.
        """
        words1 = set(s1.lower().split())
        words2 = set(s2.lower().split())
        
        if len(words1) == 0 and len(words2) == 0:
            return 1.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if len(union) > 0 else 0.0
    
    # Starter phrases that can make conversations feel robotic when overused
    STARTER_PHRASES = [
        "okay",
        "got it",
        "thanks",
        "thank you",
        "great",
        "sounds good",
        "perfect",
        "nice",
        "alright",
        "i see",
        "understood",
        "absolutely",
        "sure",
        "right",
    ]
    
    def calculate_phrase_repetition(self):
        """
        Analyze word-level and phrase-level repetition patterns.
        
        Detects overuse of conversational starters like "Okay", "Got it", etc.
        which can make conversations feel robotic even when questions differ.
        """
        questions = self.metrics.repetition_metrics.agent_questions
        
        if len(questions) == 0:
            return
        
        starter_counts: Dict[str, int] = {}
        neutral_count = 0
        
        for question in questions:
            # Get first few words (handle multi-line questions)
            first_line = question.split('\n')[0].lower().strip()
            first_words = ' '.join(first_line.split()[:4])  # First 4 words
            
            matched = False
            for phrase in self.STARTER_PHRASES:
                # Check if question starts with or contains the phrase at the beginning
                if first_words.startswith(phrase) or first_line.startswith(phrase):
                    starter_counts[phrase] = starter_counts.get(phrase, 0) + 1
                    matched = True
                    break
            
            if not matched:
                neutral_count += 1
        
        # Calculate metrics
        metrics = self.metrics.phrase_repetition_metrics
        metrics.starter_phrase_counts = starter_counts
        metrics.neutral_start_count = neutral_count
        
        # Diversity score: unique starters used / total questions
        unique_starters = len([c for c in starter_counts.values() if c > 0])
        metrics.starter_diversity_score = unique_starters / len(questions)
        
        # Most common starter
        if starter_counts:
            most_common = max(starter_counts.items(), key=lambda x: x[1])
            metrics.most_common_starter = most_common[0]
            metrics.most_common_starter_count = most_common[1]
        
        # Top 3 starters repetition rate
        sorted_counts = sorted(starter_counts.values(), reverse=True)
        top_3_count = sum(sorted_counts[:3])
        metrics.top_starter_repetition_rate = top_3_count / len(questions)
    
    # Patterns indicating achievement-focused questions (what we want more of)
    ACHIEVEMENT_PATTERNS = [
        r"proud\s+of",
        r"accomplish",
        r"achiev",
        r"success(ful)?",
        r"best\s+(moment|thing|part|experience)",
        r"difficult.{0,30}(but|then|managed|overcame|figured)",
        r"challenge.{0,20}(overcome|faced|handled)",
        r"learn(ed|t)?\s+(from|how|to)",
        r"improv(e|ed|ing)",
        r"grew|growth",
        r"stand\s*out",
        r"unique",
        r"different(ly)?\s+(than|from)",
        r"better\s+than",
        r"specifically\s+you",
        r"impact|difference\s+(you\s+)?made",
        r"result(s)?\s+(you|of\s+your)",
        r"contribution",
        r"initiative",
        r"solved|problem.{0,15}solv",
        r"created|built|developed",
        r"led|managed|supervised",
        r"first\s+time.{0,20}(managed|succeeded|able)",
    ]
    
    # Patterns indicating routine task questions (not bad, but want balance)
    ROUTINE_TASK_PATTERNS = [
        r"typical\s+day",
        r"day.{0,10}(look\s+like|like)",
        r"what.{0,10}do.{0,10}as\s+a",
        r"tasks.{0,10}(do|perform|handle)",
        r"responsibilities",
        r"what\s+else\s+do\s+you",
        r"daily\s+(tasks|routine|activities)",
        r"regular(ly)?\s+(do|tasks)",
        r"usual(ly)?\s+(do|handle)",
    ]
    
    # Patterns for factual/clarification questions
    FACTUAL_PATTERNS = [
        r"what\s+(is|was)\s+(the\s+)?(name|title|company)",
        r"when\s+did\s+you",
        r"how\s+long",
        r"where\s+(did|was|is)",
        r"is\s+that\s+correct",
        r"to\s+clarify",
        r"just\s+to\s+confirm",
    ]
    
    def calculate_question_quality(self):
        """
        Analyze question quality for achievement focus vs routine tasks.
        
        Achievement-focused questions elicit information about accomplishments,
        challenges overcome, and growth - which better differentiate candidates.
        """
        questions = self.metrics.repetition_metrics.agent_questions
        
        if len(questions) == 0:
            return
        
        metrics = self.metrics.question_quality_metrics
        metrics.total_questions_analyzed = len(questions)
        
        for question in questions:
            q_lower = question.lower()
            q_type = self._classify_question(q_lower)
            
            if q_type == "achievement":
                metrics.achievement_question_count += 1
                if len(metrics.achievement_question_examples) < 5:
                    metrics.achievement_question_examples.append(question[:200])
            elif q_type == "routine_task":
                metrics.routine_task_question_count += 1
                if len(metrics.routine_task_examples) < 5:
                    metrics.routine_task_examples.append(question[:200])
            elif q_type == "factual":
                metrics.factual_question_count += 1
            else:
                metrics.other_question_count += 1
        
        # Calculate rates
        total = metrics.total_questions_analyzed
        metrics.achievement_question_rate = (
            metrics.achievement_question_count / total * 100
        )
        metrics.routine_task_rate = (
            metrics.routine_task_question_count / total * 100
        )
    
    def _classify_question(self, question_lower: str) -> str:
        """
        Classify a question by type.
        
        Returns: "achievement", "routine_task", "factual", or "other"
        """
        # Check achievement patterns first (higher priority)
        for pattern in self.ACHIEVEMENT_PATTERNS:
            if re.search(pattern, question_lower):
                return "achievement"
        
        # Check routine task patterns
        for pattern in self.ROUTINE_TASK_PATTERNS:
            if re.search(pattern, question_lower):
                return "routine_task"
        
        # Check factual patterns
        for pattern in self.FACTUAL_PATTERNS:
            if re.search(pattern, question_lower):
                return "factual"
        
        return "other"
    
    def finalize(self):
        """Finalize metrics collection."""
        self.metrics.completed_at = datetime.utcnow().isoformat()
        self.calculate_repetition_rate()
        self.calculate_phrase_repetition()
        self.calculate_question_quality()
    
    def save_metrics(self, output_folder: Path):
        """Save metrics to output folder."""
        output_path = output_folder / 'baseline_metrics.json'
        self.metrics.save(output_path)
        return output_path
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of key metrics."""
        return {
            'test_case': self.metrics.test_case_name,
            'total_turns': self.metrics.total_turn_count,
            'total_time_sec': round(self.metrics.total_conversation_time_sec, 2),
            'total_llm_calls': self.metrics.total_llm_calls,
            'experiences_discovered': self.metrics.experience_metrics.experiences_discovered,
            'experiences_explored': self.metrics.experience_metrics.experiences_explored,
            'avg_skills_per_experience': round(
                self.metrics.experience_metrics.avg_skills_per_experience, 2
            ),
            # Semantic repetition (existing)
            'repetition_rate': round(
                self.metrics.repetition_metrics.repetition_rate, 2
            ),
            # Phrase repetition (new)
            'phrase_starter_diversity': round(
                self.metrics.phrase_repetition_metrics.starter_diversity_score, 2
            ),
            'top_starter_repetition_rate': round(
                self.metrics.phrase_repetition_metrics.top_starter_repetition_rate, 2
            ),
            'most_common_starter': self.metrics.phrase_repetition_metrics.most_common_starter,
            # Question quality (new)
            'achievement_question_rate': round(
                self.metrics.question_quality_metrics.achievement_question_rate, 1
            ),
            'routine_task_rate': round(
                self.metrics.question_quality_metrics.routine_task_rate, 1
            ),
        }

