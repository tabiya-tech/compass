## README

The purpose of our study has been to evaluate linking models to the Occupation and Skill ESCO taxonomies to choose how to do so as effectively as possible for our compass application. 

The evaluation was run on synthetic queries based on a dataset of 542 job descriptions with the corresponding ESCO code for the occupations and of 1054 sentences containing 2013 skills with the corresponding Tabiya UUID. Those synthetic queries are assumed to be similar to the input that an hypothetical user of the Brujula platform would submit. We also fixed the embedding model to be VertexAI's Gecko003.

We first focused the evaluation on a selection of hyperparameters that would guarantee the maximum recall at various values of retrieved nodes k. We assumed that k would be decided in advance and that we would prioritize retrieving the ground truth within the first k documents (recall-based approach) rather than having most retrieved documents be the ground truth (precision-based approach). The hyperparameter we considered were 
* The score function (euclidean distance, scalar product or cosine similarity);
* The usage of Maximal Marginal Relevance (MMR) or not to choose the top documents;
* How to embed each node as a combination of the collection fields.

We found that both for the occupations and for the skills, it made no difference which score function should be used, therefore leading us to maintain the **default score function**. Moreover, we found that most correct nodes could be found within the first few documents, so that **using MMR would not be beneficial to our purpose**. Finally we discovered that using only the **preferred label** guarantees a higher recall at all values of k. This happens most likely because the label encodes the core meaning of the job, even when it's not referred to directly and because it is less ambiguous than including the description or the secondary label. For higher values of k, a **combination of all fields** performs as well as the preferred label. These results were also consistent when trying to link statements from the occupation test set to the set of essential skills for the occupation node in the true value.

Another relevant experiment was the one in which we explored the possibility of having multiple embeddings per ESCO node, similar to the way in which documents can be segmented and embedded in information retrieval. We considered two approaches:

1. Each document is embedded with **three vectors** corresponding to preferred label, secondary labels and description. 
2. Each document is embedded with **more than three vectors**, including a different embedding for each secondary label.

In our retrieval function, we considered k to be the set of **unique** top ESCO codes within the first 100 entries, meaning that the more embeddings per node we load in the collection, the least amount of different nodes we will find.

We found that the **three embeddings method** is stably more effective than the **multiple embeddings method** as well as more effective than **the single combination of all fields**, probably because the embeddings are more focused and the more descriptive queries can be matched to the description directly, while those that are focused on the title can be matched to either preferred or secondary labels.

Finally, we were interested in understanding whether we would benefit from a Named Entity Recognition (NER) model that would select subspans of the query to be linked to the occupation. We did so by linking only the titles and comparing their results to the ground truth, both for the occupation evaluation and for the essential skills of the second experiment. We found that indeed linking the title guarantees an increment in recall for low values of k, but that this gains tend to disappear for higher values of k. This suggests that we might benefit from a NER model if we decide to retrieve a lower number of elements.

All of these results were also consistent when using a localised database and a localised test set for the ESCO taxonomy.

### TL;DR:
* We run evaluation on linking skills and occupations to the ESCO database using a test set of synthetic queries generated from real job descriptions.
* We found that we should use the default options of the Vector Database search while representing each node with three embeddings corresponding to each of the three fields (preferred label, secondary labels and description).
* In case only one embedding per node is permitted, we should use a combination of all fields.
* Submitting the title as query can be an effective way to improve the linking recall.

