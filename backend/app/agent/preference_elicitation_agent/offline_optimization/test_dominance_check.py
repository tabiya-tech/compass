"""Test that dominance checking works correctly in encoded space."""
import numpy as np
from app.agent.preference_elicitation_agent.offline_optimization.d_efficiency_optimizer import DEfficiencyOptimizer
from app.agent.preference_elicitation_agent.offline_optimization.profile_generator import ProfileGenerator

def test_dominance_in_encoded_space():
    """Test that dominance detection works in 7D encoded space."""
    pg = ProfileGenerator()
    optimizer = DEfficiencyOptimizer(pg)
    
    print("Testing Dominance Detection in Encoded 7D Space")
    print("=" * 80)
    
    # Test Case 1: OLD problematic vignette - should be detected as dominated
    print("\n1. Testing OLD problematic vignette (should be DOMINATED)")
    print("-" * 80)
    
    profile_a_dominated = {
        "wage": 15000,
        "physical_demand": 1,
        "flexibility": 0,
        "commute_time": 60,
        "job_security": 0,
        "remote_work": 0,
        "career_growth": 1,
        "task_variety": 0,
        "social_interaction": 0,
        "company_values": 0
    }
    
    profile_b_dominates = {
        "wage": 35000,
        "physical_demand": 0,
        "flexibility": 1,
        "commute_time": 15,
        "job_security": 1,
        "remote_work": 1,
        "career_growth": 0,
        "task_variety": 1,
        "social_interaction": 1,
        "company_values": 1
    }
    
    has_dominance = optimizer._has_pairwise_dominance(profile_a_dominated, profile_b_dominates)
    print(f"Has dominance? {has_dominance}")
    
    if has_dominance:
        print("✅ PASS: Correctly detected dominance (B dominates A in 6/7 dimensions)")
    else:
        print("❌ FAIL: Should have detected dominance")
    
    # Test Case 2: Balanced vignette - should NOT be dominated
    print("\n2. Testing balanced vignette (should NOT be dominated)")
    print("-" * 80)
    
    profile_a_balanced = {
        "wage": 15000,
        "physical_demand": 0,
        "flexibility": 1,
        "commute_time": 15,
        "job_security": 1,
        "remote_work": 1,
        "career_growth": 1,
        "task_variety": 1,
        "social_interaction": 0,
        "company_values": 0
    }
    
    profile_b_balanced = {
        "wage": 35000,
        "physical_demand": 1,
        "flexibility": 0,
        "commute_time": 60,
        "job_security": 0,
        "remote_work": 0,
        "career_growth": 0,
        "task_variety": 0,
        "social_interaction": 0,
        "company_values": 1
    }
    
    has_dominance = optimizer._has_pairwise_dominance(profile_a_balanced, profile_b_balanced)
    print(f"Has dominance? {has_dominance}")
    
    if not has_dominance:
        print("✅ PASS: Correctly identified no dominance (5 vs 2 dimensions)")
    else:
        print("❌ FAIL: Should NOT have detected dominance")
    
    # Test Case 3: Edge case - identical profiles
    print("\n3. Testing identical profiles (should NOT be dominated)")
    print("-" * 80)
    
    profile_identical = {
        "wage": 25000,
        "physical_demand": 0,
        "flexibility": 1,
        "commute_time": 30,
        "job_security": 1,
        "remote_work": 1,
        "career_growth": 0,
        "task_variety": 1,
        "social_interaction": 1,
        "company_values": 1
    }
    
    has_dominance = optimizer._has_pairwise_dominance(profile_identical, profile_identical)
    print(f"Has dominance? {has_dominance}")
    
    if not has_dominance:
        print("✅ PASS: Correctly identified no dominance (identical profiles)")
    else:
        print("❌ FAIL: Should NOT have detected dominance for identical profiles")
    
    # Test Case 4: Direct feature dominance test
    print("\n4. Testing _features_dominate() directly")
    print("-" * 80)
    
    features_a = np.array([1.5, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0])
    features_b = np.array([3.5, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0])
    
    b_dominates_a = optimizer._features_dominate(features_b, features_a)
    print(f"Features B dominates A? {b_dominates_a}")
    
    if b_dominates_a:
        print("✅ PASS: Correctly detected B dominates A (6 out of 7 dimensions)")
    else:
        print("❌ FAIL: Should have detected B dominates A")
    
    # Summary
    print("\n" + "=" * 80)
    print("All tests completed!")

if __name__ == "__main__":
    test_dominance_in_encoded_space()
