"""
Decorators that keep instrumented call sites to a single line.

`traced_agent` is what makes agent-level attribution work: it opens an "agent" observation *and*
sets `agent_type_ctx_var`, so agents that never go through the LLM agent director — Career Readiness
and Career Explorer — are attributed just as well as the ones that do.
"""

import functools
import inspect
import logging
from typing import Any, Callable, Optional

from app.context_vars import agent_type_ctx_var
from common_libs.observability.tracing import traced_observation, update_observation

logger = logging.getLogger(__name__)

# Marks an already-wrapped function so that subclassing an instrumented class does not double-wrap.
_TRACED_MARKER = "__compass_traced__"


def _resolve_agent_type(instance: Any, explicit: Optional[str]) -> str:
    """
    Work out the agent type to report for an instance, preferring an explicit value, then the
    `agent_type` property that `app.agent.agent.Agent` exposes, then the class name.
    """
    if explicit:
        return explicit

    agent_type = getattr(instance, "agent_type", None)
    if agent_type is not None:
        return getattr(agent_type, "value", str(agent_type))

    return type(instance).__name__


def traced_agent(agent_type: Optional[str] = None) -> Callable:
    """
    Wrap an agent's async `execute` so that it runs inside an "agent" observation.

    :param agent_type: The agent type to report. Defaults to the instance's `agent_type`, then to
        the class name.
    :return: The decorator.
    """

    def decorator(fn: Callable) -> Callable:
        if getattr(fn, _TRACED_MARKER, False):
            return fn

        @functools.wraps(fn)
        async def wrapper(self, *args, **kwargs):
            resolved_type = _resolve_agent_type(self, agent_type)
            agent_type_token = agent_type_ctx_var.set(resolved_type)
            try:
                with traced_observation(
                        name=resolved_type,
                        as_type="agent",
                        metadata={"agent_type": resolved_type},
                ) as observation:
                    output = await fn(self, *args, **kwargs)
                    update_observation(observation, output=output)
                    return output
            finally:
                # Restore whatever the caller had set, so a nested agent does not clobber the
                # agent type of the director that invoked it.
                agent_type_ctx_var.reset(agent_type_token)

        setattr(wrapper, _TRACED_MARKER, True)
        return wrapper

    return decorator


def traced_tool(name: Optional[str] = None, *, as_type: str = "tool") -> Callable:
    """
    Wrap an async function or method so that it runs inside a tool observation.

    :param name: The observation name. Defaults to the wrapped function's qualified name.
    :param as_type: The Langfuse observation type; "tool" by default, "chain" for multi-step work.
    :return: The decorator.
    """

    def decorator(fn: Callable) -> Callable:
        if getattr(fn, _TRACED_MARKER, False):
            return fn

        observation_name = name or fn.__qualname__

        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            with traced_observation(name=observation_name, as_type=as_type) as observation:
                output = await fn(*args, **kwargs)
                update_observation(observation, output=output)
                return output

        setattr(wrapper, _TRACED_MARKER, True)
        return wrapper

    return decorator


def instrument_agent_execute(cls: type) -> None:
    """
    Instrument the `execute` method a class defines itself, if it defines one.

    Called from `Agent.__init_subclass__` so that every agent gets an observation without each
    subclass having to remember the decorator. Only `cls.__dict__` is inspected, so an inherited
    (already instrumented) `execute` is left alone.

    :param cls: The class to instrument.
    """
    execute = cls.__dict__.get("execute")
    if execute is None or not inspect.iscoroutinefunction(execute):
        return

    setattr(cls, "execute", traced_agent()(execute))
