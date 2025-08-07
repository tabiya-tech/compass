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
        return 1.0

    rank = stats.percentileofscore(job_seekers_ranks, participant_rank, kind='mean')

    # Round to four decimal places for consistency (100.00 when converted to percentage it will be two decimal places)
    # Convert to the decimal percentage between 0 and 1
    return round(rank / 100, 4)
