def _calculate_overlap_score(*,
                             opportunity_skills_uuids: set[str],
                             participant_skills_uuids: set[str]) -> float:
    """
    Checks how a user is matched to a opportunity based on their skills,
    """

    # Find the common UUIDs between the opportunity and the person's skills.
    overlapping_uuids = opportunity_skills_uuids.intersection(participant_skills_uuids)

    # Avoid division by zero if no UUID columns in opportunities (ie: a opportunity has zero skills).
    if len(opportunity_skills_uuids) == 0:
        return 0.0


    # Calculate the final score.
    score = len(overlapping_uuids) / len(opportunity_skills_uuids)
    return score


def get_opportunity_ranking(*,
                            opportunities_skills_uuids: list[set[str]],
                            participant_skills_uuids: set[str],
                            opportunity_matching_threshold: float = 0) -> float:
    """
    Computes the opportunity ranking for a participant based on their skills, and the skills of other jobseekers.
    """

    scores = [
        _calculate_overlap_score(
            opportunity_skills_uuids=opportunity_skills,
            participant_skills_uuids=participant_skills_uuids
        ) for opportunity_skills in opportunities_skills_uuids
    ]

    scores_above_threshold = [score for score in scores if score >= opportunity_matching_threshold]

    percentage_above_threshold = (len(scores_above_threshold) / len(scores)) * 100 if scores else 0

    return percentage_above_threshold
