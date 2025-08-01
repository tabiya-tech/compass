from scipy import stats

def other_job_seekers_ranking(*,
                              job_seekers_ranks: list[float],
                              participant_rank: float):
    """
    Compare the participant's rank against the distribution of other jobseekers' ranks.

    :param job_seekers_ranks: The list of all jobseekers' ranks. (1-D array of floats)
    :param participant_rank: The new participant's rank.
    :return: The percentile of the participant's rank in the distribution of other jobseekers' ranks.
    """

    if not job_seekers_ranks:
        return 100.0

    rank = stats.percentileofscore(job_seekers_ranks, participant_rank, kind='rank')

    return round(rank, 2) # Round to two decimal places for consistency
