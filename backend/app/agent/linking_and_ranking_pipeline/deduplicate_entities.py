import logging
from typing import TypeVar, Optional

from app.vector_search.esco_entities import BaseEntity

T = TypeVar('T', bound=BaseEntity)


def _clone_entity(entity: T, preferred_label: Optional[str] = None) -> BaseEntity:
    """
    Clone an entity with a new preferredLabel.
    This is used to avoid modifying the original entity when passing it to the LLM.
    :param entity: The entity to clone
    :param preferred_label: The new preferredLabel for the cloned entity. If None, the original preferredLabel is used.
    :return: The cloned entity

    """
    return BaseEntity(
        id=entity.id,
        modelId=entity.modelId,
        UUID=entity.UUID,
        preferredLabel=preferred_label or entity.preferredLabel,
        altLabels=list(entity.altLabels),  # <-- make a shallow copy!,
        scopeNote=entity.scopeNote,
        originUUID=entity.originUUID,
        UUIDHistory=entity.UUIDHistory,
        description=entity.description,
        score=entity.score
    )


def deduplicate_entities(original_entities: list[T], logger: logging.Logger) -> tuple[dict[str, T], list[BaseEntity]]:
    """
    Deduplicate entities based on their preferredLabel and altLabels.

    The taxonomy model does not improse any constraint on the uniqueness of the preferredLabel or the altLabels.
    When passing the entities to the LLM we pass them with a "title" that corresponds to the preferredLabel or altLabel.
    Entities with the same preferredLabel are considered duplicates.
    If a duplicate is found, the first altLabel is used as the title.
    If no altLabel is found, the entity is ignored as it is not possible to classify it.

    :param original_entities: The original list of entities to deduplicate.
    :param logger: The logger to use for logging warnings.
    :return: A tuple containing:
        - A dictionary mapping the preferredLabel or altLabel to the entity chosen to represent it.
        - A list of clones of the entities, with the preferredLabel set to the preferredLabel or altLabel used to represent it.
          This list is used to pass the entities to the LLM for performing any task.
          When the LLM returns any selected entity, it will return the preferredLabel or altLabel used to represent it.
          The dictionary is used  find the entity in the original list of entities based on the preferredLabel or altLabel returned by the LLM.
    """
    original_entities_lookup_dict: dict[str, T] = {}
    deduplicated_entities_to_classify: list[BaseEntity] = []  # currently we are interested only in the title and description of the entity
    for entity in original_entities:
        # since preferredLabel is not unique, if a duplicate is found, then the alternative label is used
        if original_entities_lookup_dict.get(entity.preferredLabel, None) is None:
            original_entities_lookup_dict[entity.preferredLabel] = entity
            deduplicated_entities_to_classify.append(_clone_entity(entity))
        else:
            # if the preferredLabel is already in the dict, then use the first altLabel
            found_alt_label = False
            for alt_label in entity.altLabels:
                if original_entities_lookup_dict.get(alt_label, None) is None:
                    original_entities_lookup_dict[alt_label] = entity
                    logger.warning("Entity '%s' has duplicate preferredLabel '%s', using the altLabel '%s'",
                                   entity.UUID,
                                   entity.preferredLabel,
                                   alt_label)
                    found_alt_label = True
                    deduplicated_entities_to_classify.append(_clone_entity(entity, alt_label))
                    break
            # Could not find an altLabel, so ignore the entity
            if not found_alt_label:
                logger.warning("Entity '%s' has duplicate preferredLabel '%s', but no altLabel found. Ignoring the entity.",
                               entity.UUID, entity.preferredLabel)

    return original_entities_lookup_dict, deduplicated_entities_to_classify
