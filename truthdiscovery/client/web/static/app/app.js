const MATRIX_INPUT_FOCUS_DELAY = 200;
const DATA = (JSON.parse(document.getElementById("data-json").innerHTML
                  .replace(/&#34;/g, '"')));

angular.module("tdApp", []);

var graph_drawer = new GraphDrawer();
var animator = new Animator();

// Service to make HTTP requests and get results
angular.
    module("tdApp").
    service("tdService", ["$http", function($http) {
        this.url = "/run/";
        this.method = "GET";
        this.state = "empty";
        this.results = null;
        this.previous_results = null;

        /*
         * Make the HTTP request to get results of an algorithm
         */
        this.getResults = function(algorithm, matrix, compare_previous,
                                   iteration, alg_params, imagery) {
            // Build parameters to send to server
            if (algorithm !== "voting") {
                if (alg_params !== "") {
                    alg_params += "\n";
                }
                alg_params += this.getIterationString(iteration);
            }
            var params = {
                "algorithm": algorithm,
                "matrix": matrix
            };
            if (alg_params !== "") {
                params.parameters = alg_params;
            };
            if (compare_previous && this.previous_results !== null) {
                params.previous_results = JSON.stringify(this.previous_results);

            }
            if (imagery.graph) {
                params.get_graph = "yes-please";
            }
            if (imagery.animation && algorithm !== "voting") {
                params.get_animation = "an-animation-would-be-splendid";
            }

            this.state = "loading";
            var promise = $http({
                "url": this.url,
                "method": this.method,
                "params": params
            });
            var self = this;
            promise.then(function(response) {
                // Our server's response is in response.data, and is an object
                // with keys 'ok' and 'data' (in the success case)
                self.results = response.data.data;
                self.state = "has_results";
                // Save 'previous' results now, so that we may change structure
                // of self.results without affecting data sent to server
                self.previous_results = JSON.parse(JSON.stringify(self.results));

                if ("imagery" in self.results) {
                    if ("graph" in self.results.imagery) {
                        var obj = JSON.parse(self.results.imagery.graph);
                        graph_drawer.grab_canvas("graph-canvas");
                        graph_drawer.draw_graph(obj);
                    }
                    if ("animation" in self.results.imagery) {
                        var obj = JSON.parse(self.results.imagery.animation);
                        animator.load(obj);
                    }
                    // Remove imagery from previous results, if present
                    delete self.previous_results.imagery;
                }

                // Calculate and store the maximum trust and belief scores, so
                // that they can be highlighted in the results
                self.results.max_trust = Math.max.apply(
                    null,
                    Object.values(self.results.trust)
                );
                self.results.max_belief = {};
                for (var variable in self.results.belief) {
                    self.results.max_belief[variable] = Math.max.apply(
                        null,
                        Object.values(self.results.belief[variable])
                    );
                }

                // Reformat trust object from {source: trust, ...} to an array
                // [{"source": source, "trust": trust}, ...] since this allows
                // the results to be sorted in template. Similar for beliefs
                var array_trust = [];
                for (var source in self.results.trust) {
                    array_trust.push({
                        "source": source,
                        "trust": self.results.trust[source]
                    });
                }
                self.results.trust = array_trust;

                for (var variable in self.results.belief) {
                    var array_belief = [];
                    for (var val in self.results.belief[variable]) {
                        array_belief.push({
                            "val": val,
                            "belief": self.results.belief[variable][val]
                        });
                    }
                    self.results.belief[variable] = array_belief;
                }

            }, function(error) {
                self.state = "empty";
            });
            return promise;
        };

        /*
         * Convert an object of iteration settings to a key=value string to be
         * passed to the server
         */
        this.getIterationString = function(iteration) {
            var value = null;
            if (iteration.type == "fixed") {
                value = "fixed-" + iteration.limit.toString();
            }
            else if (iteration.type == "convergence") {
                value = iteration.measure + "-convergence-"
                        + iteration.threshold.toFixed(10) + "-limit-100";
            }
            else {
                throw "unknown iteration type: " + iteration.type;
            }

            return "iterator=" + value;
        };
    }]);

// Form component
angular.
    module("tdApp").
    component("mainForm", {
        "templateUrl": "/static/app/templates/form.html",
        "controller": function MainformController(tdService) {
            this.service = tdService;
            this.error = null;  // error message to show underneath form
            this.algorithm = "sums";
            this.compare_results = true;
            this.iteration = {
                "type": "fixed",
                "limit": 20,
                "measure": "l2",
                "threshold": 0.001
            };
            this.alg_params = "";
            this.imagery = {
                "graph": true,
                "animation": true
            };

            this.preset_datasets = {
                "standard": {
                    "name": "Typical truth-discovery dataset",
                    "entries": [
                        [1, null, 3, 4],
                        [2, 2, null, null],
                        [null, null, 7, null],
                        [1, 2, 5, null]
                    ],
                    "description": "A typical dataset with a mixture of " +
                                   "agreements, disagreements and missing " +
                                   "values"
                },
                "all_but_one_agree": {
                    "name": "All agree but one",
                    "entries": [
                        [1, 2, 3, 4],
                        [1, 2, 3, 4],
                        [1, 2, 3, 4],
                        [9, 8, 7, 6]
                    ],
                    "description": "Dataset where all sources but one agree " +
                                   "on each variable"
                },
                "indep_groups": {
                    "name": "Independent groups",
                    "entries": [
                        [1, 2, null, null],
                        [1, 3, null, null],
                        [null, null, 11, 12],
                        [null, null, 10, null],
                    ],
                    "description": "Dataset where sources and variables are " +
                                   "split into two independent groups"
                },
                "no_agreement": {
                    "name": "No agreement",
                    "entries": [
                        [null, 2, 3],
                        [4, 5, null],
                        [null, 8, 9],
                        [10, 11, 12]
                    ],
                    "description": "Dataset where no sources agree with each other"
                }
            };
            this.selected_preset = Object.keys(this.preset_datasets)[0];
            this.matrix = null;  // Set after method definitions

            this.load_csv = {
                "dialog_open": false,
                "error": "",
                "textarea": ""
            };

            this.algorithm_labels = DATA.algorithm_labels;
            this.distance_measures = DATA.distance_measures;

            var self = this;

            this.toggleCsvDialog = function() {
                self.load_csv.dialog_open ^= true;
                self.load_csv.error = "";
            };

            this.loadFromCSV = function() {
                try {
                    self.matrix = self.matrix.loadFromCSV(self.load_csv.textarea);
                    self.load_csv.dialog_open = false;
                }
                catch (err) {
                    self.load_csv.error = err;
                }
            };

            /*
             * Update the matrix to the preset with the given label
             */
            this.loadPresetDataset = function(label) {
                if (!label) {
                    return;
                }
                // Copy entries, so that modifying the matrix does not change
                // the presets
                var entries = [];
                var preset_entries = self.preset_datasets[label].entries;
                for (var i=0; i<preset_entries.length; i++) {
                    var row = [];
                    for (var j=0; j<preset_entries[i].length; j++) {
                        row.push(preset_entries[i][j]);
                    }
                    entries.push(row);
                }
                self.matrix = new Matrix(entries);
                self.selected_preset = "";
            };

            this.run = function() {
                var promise = tdService.getResults(
                    self.algorithm, self.matrix.asCSV(), self.compare_results,
                    self.iteration, self.alg_params, self.imagery
                );
                // Cancel errors while we wait for response
                self.error = null;

                promise.catch(function(response) {
                    if (typeof(response.data) === "object" && "error" in response.data) {
                        // Set error message on failure
                        self.error = response.data.error;
                        self.error = self.error[0].toUpperCase() + self.error.slice(1);
                    }
                    else {
                        self.error = "Unknown error :("
                    }
                });
            };

            this.loadPresetDataset(this.selected_preset);
        }
    });

// Results component
angular.
    module("tdApp").
    component("results", {
        "templateUrl": "/static/app/templates/results.html",
        "controller": function ResultsController(tdService) {
            this.service = tdService;

            // Flags for which sections to display
            this.output = {
                "trust": true,
                "belief": true,
                "visual": true
            };

            this.sorting = {
                "trust": {
                    "col": "source",
                    "ascending": true,
                },
                "belief": {
                    "col": "val",
                    "ascending": true
                }
            };

            var icon_names = {
                "unsorted": "icon-resize-vert",
                "ascending": "icon-arrow-up",
                "descending": "icon-arrow-down",
            };

            this.sort_icons = {
                "source": icon_names.unsorted,
                "trust": icon_names.unsorted,
                "val": icon_names.unsorted,
                "belief": icon_names.unsorted
            };

            this.animator = animator;  // global animator

            var self = this;

            this.getDiffClass = function(difference) {
                if (difference > 0) {
                    return "text-success";
                }
                else if (difference < 0) {
                    return "text-error";
                }
                return "text-gray";
            };

            this.formatDiff = function(difference) {
                if (difference === undefined) {
                    return "";
                }
                var prefix = (difference >= 0 ? "+" : "-");
                return "(" + prefix + Math.abs(difference) + ")";
            }

            /*
             * Change the sort order of the given table to sort by the given
             * column, toggling asc/desc if already sorted on that column
             */
            this.sort = function(table, col) {
                var current_col = self.sorting[table].col;
                if (current_col !== col) {
                    // Reset the current sort column's icon to 'unsorted'
                    self.sort_icons[current_col] = icon_names.unsorted;
                    self.sorting[table].col = col;
                    self.sorting[table].ascending = false;
                    self.sort_icons[col] = icon_names.descending;
                    return;
                }

                self.sorting[table].ascending ^= true;
                self.sort_icons[col] = (self.sorting[table].ascending ?
                                        icon_names.ascending : icon_names.descending);
            };

            /*
             * Return argument for 'orderBy' filter for the sorting of the
             * specified table
             */
            this.getSortOrderBy = function(table) {
                var prefix = (self.sorting[table].ascending ? "+" : "-");
                return prefix + self.sorting[table].col;
            };

            /*
             * Return the CSS class for the icon to show next to a section
             * heading, which changes depending on whether the section is
             * expanded or not
             */
            this.getSectionIcon = function(section) {
                return self.output[section] ? "icon-arrow-down" : "icon-arrow-right";
            };
        }
    });

angular.
    module("tdApp").
    filter("formatDistanceMeasure", function() {
        return function(input) {
            var no_under = input.replace("_", " ");
            return no_under[0].toUpperCase() + no_under.slice(1);
        };
    });
