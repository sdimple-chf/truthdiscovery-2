The graphs shows the run-time of various algorithms on synthetic datasets as
the number of sources and variables increase.

 First a synthetic dataset with 2000 sources and 2000 variables was created.
 Then two experiments were performed: one where the number of variables is
 fixed at 500 and the number of sources varies from 100 to 2000 (in increments
 of 200), and another where the number of sources is fixed and the number of
 variables varies. All datasets used in the experiments were generated by
 taking a subset of the large 2000x2000 dataset.

TODO:
-----
Need to perform larger tests (maybe go up to 10K instead of 2K) on a better
machine with nothing else running.

Also perform tests for binary variables only.