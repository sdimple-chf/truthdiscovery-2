import random

import numpy.ma as ma

from truthdiscovery.input.dataset import Dataset


class SupervisedData:
    """
    A class to store a dataset for which the true values of a subset of the
    variables is known
    """
    def __init__(self, dataset, true_values):
        """
        :param dataset:     a Dataset (or sub-class) object
        :param true_values: numpy array of true values for the variables.
                            Length must be the same as the number of variables.
                            May be a masked array if not all true values are
                            known.
        """
        self.data = dataset
        if (true_values.ndim != 1
                or true_values.shape[0] != self.data.sv.shape[1]):
            raise ValueError(
                "Number of true values must be the same as the number of"
                "variables"
            )

        self.values = true_values

    def get_accuracy(self, results):
        """
        Calculate the accuracy of truth-discovery results, computed as the
        frequency of cases where the most believed value for a variable is the
        correct one, ignoring cases where only one value for a variable is
        claimed across all sources (in this case all algorithms will predict
        the same value).

        :param results: a :any:`Result` object
        :return: accuracy as a number in [0, 1]: 1 is best accuracy, 0 is worst
        """
        total = 0
        count = 0
        for var, true_value in enumerate(self.values):
            if ma.is_masked(true_value):
                continue

            # Skip if there is only one claimed value
            if len(results.belief[var]) == 1:
                continue

            total += 1
            # Note: select value randomly if more than one most-believed value
            # exists
            most_believed = random.choice(
                list(results.get_most_believed_values(var))
            )
            if most_believed == true_value:
                count += 1
        if total == 0:
            raise ValueError(
                "No known variables where more than one claimed value exists"
            )
        return count / total

    @classmethod
    def from_csv(cls, path):
        """
        Load a matrix from a CSV file along with true values. The format is the
        same as for loading an unsupervised dataset, but the first row contains
        the true values.

        :param path: path on disk to a CSV file
        :return:     a SupervisedData object representing the matrix encoded by
                     the CSV
        """
        temp = Dataset.from_csv(path)  # Load the whole thing as a matrix
        true_values = temp.sv[0, :]
        sv_mat = temp.sv[1:, :]
        return cls(Dataset(sv_mat), true_values)

    def to_csv(self):
        """
        :return: a string representation of data and true values in CSV format
        """
        rows, cols = self.data.sv.shape
        temp = ma.masked_all((rows + 1, cols))
        temp[0, :] = self.values
        temp[1:, :] = self.data.sv
        return Dataset(temp).to_csv()
