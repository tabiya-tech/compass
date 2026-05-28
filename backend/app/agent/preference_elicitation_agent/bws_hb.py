"""
Hierarchical Bayes (HB) scoring for Best-Worst Scaling — single respondent.

Produces continuous utility estimates alongside the existing count-based scoring.
Uses a Metropolis random-walk MCMC sampler with no external dependencies beyond
numpy and scipy.

Model:
    beta_j ~ Normal(0, 2.0)   # weak prior; data dominates for all 37 shown items
    P(best=i, worst=k | set S) = exp(beta_i - beta_k) / Σ_{p≠q ∈ S} exp(beta_p - beta_q)

Identification: sum-to-zero constraint applied after each MH step.
"""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field

import numpy as np
from scipy import stats  # used only for Normal log-pdf in log-prior

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class HBItemResult:
    """Posterior summary for a single WA item."""
    wa_id: str
    mean: float       # posterior mean utility
    sd: float         # posterior std dev
    ci_low: float     # 2.5th percentile
    ci_high: float    # 97.5th percentile
    rank: int         # 1 = most preferred


@dataclass
class HBResult:
    """Full HB scoring result for all items."""
    items: list[HBItemResult]   # all items, sorted by mean desc
    top_k: list[str]            # WA_Element_IDs of top-k items
    n_draws: int                # MCMC draws used (after burn-in)
    converged: bool             # basic convergence flag


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def run_hb_bws(
    bws_responses: list[dict],
    all_wa_ids: list[str],
    n_iter: int = 1500,
    burn: int = 500,
    prop_sd: float = 0.4,
    k: int = 8,
) -> HBResult:
    """
    Run HB scoring on BWS responses and return utility estimates for all items.

    Args:
        bws_responses: List of BWS response dicts, each with keys:
            "task_id", "alts" (list of WA_Element_IDs), "best", "worst"
        all_wa_ids: Ordered list of all WA_Element_IDs (defines item index space)
        n_iter: Total MCMC iterations (including burn-in)
        burn: Number of burn-in iterations to discard
        prop_sd: Proposal standard deviation for Metropolis random walk
        k: Number of top items to include in top_k list

    Returns:
        HBResult with all items ranked by posterior mean utility
    """
    t0 = time.time()
    J = len(all_wa_ids)

    tasks, choices = _build_task_index(bws_responses, all_wa_ids)

    if not tasks:
        # No valid responses — return uniform (all means=0, max uncertainty)
        logger.warning("HB scoring: no valid BWS responses, returning uniform utilities")
        items = [
            HBItemResult(wa_id=wa_id, mean=0.0, sd=2.0, ci_low=-4.0, ci_high=4.0, rank=i + 1)
            for i, wa_id in enumerate(all_wa_ids)
        ]
        return HBResult(items=items, top_k=all_wa_ids[:k], n_draws=0, converged=False)

    draws = _run_sampler(tasks, choices, J, n_iter=n_iter, burn=burn, prop_sd=prop_sd)
    n_draws = draws.shape[0]

    # Posterior summaries
    means = draws.mean(axis=0)
    sds   = draws.std(axis=0)
    cis   = np.percentile(draws, [2.5, 97.5], axis=0)  # shape (2, J)

    # Sort by mean descending → assign ranks
    order = np.argsort(-means)
    items = []
    for rank_idx, j in enumerate(order):
        items.append(HBItemResult(
            wa_id   = all_wa_ids[j],
            mean    = float(means[j]),
            sd      = float(sds[j]),
            ci_low  = float(cis[0, j]),
            ci_high = float(cis[1, j]),
            rank    = rank_idx + 1,
        ))

    top_k_ids = [item.wa_id for item in items[:k]]

    # Convergence check: compare std of first vs second half of draws
    mid = n_draws // 2
    first_half_std  = draws[:mid].std(axis=0).mean()
    second_half_std = draws[mid:].std(axis=0).mean()
    converged = bool(abs(first_half_std - second_half_std) / (first_half_std + 1e-10) < 0.20)

    elapsed = time.time() - t0
    logger.debug(
        f"HB scoring: J={J}, tasks={len(tasks)}, draws={n_draws}, "
        f"converged={converged}, elapsed={elapsed:.3f}s"
    )

    return HBResult(items=items, top_k=top_k_ids, n_draws=n_draws, converged=converged)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_task_index(
    bws_responses: list[dict],
    all_wa_ids: list[str],
) -> tuple[list[list[int]], list[tuple[int, int]]]:
    """
    Convert BWS response dicts to integer-indexed data structures.

    Args:
        bws_responses: Raw BWS response dicts
        all_wa_ids: Master list of WA_Element_IDs (defines integer indices)

    Returns:
        tasks:   list of sets-of-indices, one per response
        choices: list of (best_idx_in_all_wa_ids, worst_idx_in_all_wa_ids)

    Responses with unrecognised WA IDs are silently skipped.
    """
    id_to_idx = {wa_id: i for i, wa_id in enumerate(all_wa_ids)}

    tasks: list[list[int]] = []
    choices: list[tuple[int, int]] = []

    for resp in bws_responses:
        alts  = resp.get("alts", [])
        best  = resp.get("best")
        worst = resp.get("worst")

        if not alts or best is None or worst is None:
            continue

        # Convert alts to indices, skip any unknown IDs
        alt_indices = [id_to_idx[wa_id] for wa_id in alts if wa_id in id_to_idx]
        if len(alt_indices) < 2:
            continue

        best_idx  = id_to_idx.get(best)
        worst_idx = id_to_idx.get(worst)
        if best_idx is None or worst_idx is None:
            continue
        if best_idx not in alt_indices or worst_idx not in alt_indices:
            continue
        if best_idx == worst_idx:
            continue

        tasks.append(alt_indices)
        choices.append((best_idx, worst_idx))

    return tasks, choices


def _log_likelihood(beta: np.ndarray, tasks: list[list[int]], choices: list[tuple[int, int]]) -> float:
    """
    Compute log-likelihood of best-worst choices given utilities beta.

    For each task: P(best=i, worst=k | set S) = exp(β_i − β_k) / Z
    where Z = Σ_{p≠q ∈ S} exp(β_p − β_q).

    Uses log-sum-exp for numerical stability.
    """
    ll = 0.0
    for alt_indices, (best_idx, worst_idx) in zip(tasks, choices):
        b = beta[alt_indices]  # utilities of items in this set

        # log numerator: β_best - β_worst
        log_num = beta[best_idx] - beta[worst_idx]

        # log denominator: log Σ_{p≠q} exp(β_p - β_q)
        # = log Σ_p Σ_{q≠p} exp(β_p - β_q)
        # Compute all pairwise β_p - β_q for p≠q
        n = len(b)
        log_terms = []
        for pi in range(n):
            for qi in range(n):
                if pi != qi:
                    log_terms.append(b[pi] - b[qi])

        # log-sum-exp over all pairs
        log_terms_arr = np.array(log_terms)
        max_t = log_terms_arr.max()
        log_denom = max_t + np.log(np.exp(log_terms_arr - max_t).sum())

        ll += log_num - log_denom

    return float(ll)


def _log_prior(beta: np.ndarray, prior_sd: float = 2.0) -> float:
    """Normal(0, prior_sd) prior on each utility, sum-to-zero identified."""
    return float(stats.norm.logpdf(beta, loc=0.0, scale=prior_sd).sum())


def _run_sampler(
    tasks: list[list[int]],
    choices: list[tuple[int, int]],
    J: int,
    n_iter: int = 1500,
    burn: int = 500,
    prop_sd: float = 0.4,
) -> np.ndarray:
    """
    Metropolis random-walk sampler for single-respondent BWS utilities.

    Runs n_iter steps; discards first `burn` samples.
    Applies sum-to-zero identification after each step.

    Args:
        tasks:   List of lists of item indices per BWS task
        choices: List of (best_global_idx, worst_global_idx) per task
        J:       Total number of items
        n_iter:  Total MCMC iterations
        burn:    Burn-in iterations to discard
        prop_sd: Random-walk proposal standard deviation

    Returns:
        draws: np.ndarray of shape (n_iter - burn, J)
    """
    rng = np.random.default_rng(seed=42)

    # Initialise at zero
    beta = np.zeros(J)

    n_draws = n_iter - burn
    draws   = np.empty((n_draws, J))

    current_ll  = _log_likelihood(beta, tasks, choices)
    current_lp  = _log_prior(beta)
    current_log = current_ll + current_lp

    accepted = 0
    draw_idx = 0

    for step in range(n_iter):
        # Propose: add Gaussian noise to all utilities
        proposal = beta + rng.normal(0.0, prop_sd, size=J)

        # Sum-to-zero identification
        proposal -= proposal.mean()

        # Accept/reject
        prop_ll  = _log_likelihood(proposal, tasks, choices)
        prop_lp  = _log_prior(proposal)
        prop_log = prop_ll + prop_lp

        log_alpha = prop_log - current_log
        if np.log(rng.uniform()) < log_alpha:
            beta         = proposal
            current_log  = prop_log
            if step >= burn:
                accepted += 1

        # Enforce identification on current state
        beta -= beta.mean()

        if step >= burn:
            draws[draw_idx] = beta
            draw_idx += 1

    acceptance_rate = accepted / max(n_draws, 1)
    logger.debug(f"Metropolis acceptance rate: {acceptance_rate:.2%}")

    return draws
