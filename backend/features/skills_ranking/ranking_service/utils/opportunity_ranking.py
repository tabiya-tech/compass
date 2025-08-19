def _calculate_overlap_score(*,
                             opportunity_skills_uuids: set[str],
                             participant_skills_uuids: set[str]) -> float:
    """
    Checks how a participant is matched to an opportunity based on their skills,
    :returns a percentage: 0-1
    """
    # Avoid division by zero if no UUID columns in opportunities (i.e.: an opportunity has zero skills).
    # If the opportunity has no skills, we consider it a perfect match for everyone.
    if len(opportunity_skills_uuids) == 0:
        return 1

    # Find the common UUIDs between the opportunity and the person's skills.
    overlapping_uuids = opportunity_skills_uuids.intersection(participant_skills_uuids)

    # Calculate the final score.
    score = len(overlapping_uuids) / len(opportunity_skills_uuids)
    return score


def get_opportunity_ranking(*,
                            opportunities_skills_uuids: list[set[str]],
                            participant_skills_uuids: set[str],
                            opportunity_matching_threshold: float = 0) -> float:
    """
    Computes the opportunity ranking for a participant based on their skills, and the skills of other jobseekers.
    :returns the percentage of opportunities that match the participant's skills above the threshold. (0-1)
    """

    total_opportunities = 0
    matching_opportunities = 0

    for opportunity_skills in opportunities_skills_uuids:
        score = _calculate_overlap_score(
                    opportunity_skills_uuids=opportunity_skills,
                    participant_skills_uuids=participant_skills_uuids)


        total_opportunities += 1
        if score >= opportunity_matching_threshold:
            matching_opportunities += 1

    percentage_above_threshold = (matching_opportunities / total_opportunities) if total_opportunities else 0
    return percentage_above_threshold
