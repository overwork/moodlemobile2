// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.addons.mod_assign')

/**
 * Directive to render an submission.
 *
 * @module mm.addons.mod_assign
 * @ngdoc directive
 * @name mmaModAssignSubmission
 * @description
 * Directive to render submission.
 */
.directive('mmaModAssignSubmission', function($mmaModAssign, $translate, $mmUser, mmaModAssignAttemptReopenMethodNone, $q, $mmSite,
        mmaModAssignUnlimitedAttempts, mmUserProfileState, mmaModAssignSubmissionStatusNew, mmaModAssignSubmissionStatusSubmitted,
        mmaModAssignSubmissionInvalidatedEvent, $mmGroups, $state, $mmaModAssignHelper, mmaModAssignSubmissionStatusReopened,
        $mmEvents, mmaModAssignSubmittedForGradingEvent, $mmFileUploaderHelper, $mmApp, $mmText, mmaModAssignComponent, $mmUtil,
        $mmaModAssignOffline, mmaModAssignEventManualSynced, $mmCourse, $mmAddonManager, mmaModAssignAttemptReopenMethodManual,
        $mmLang) {

    /**
     * Set the submission status name and class.
     *
     * @param {Object} scope  Directive scope.
     * @param {Object} assign Assignment.
     * @param {Object} status Submission status.
     */
    function setStatusNameAndClass(scope, assign, status) {
        if (scope.hasOffline) {
            // Offline data.
            scope.statusTranslated = $translate.instant('mm.core.notsent');
            scope.statusClass = 'badge-energized';
        } else if (!assign.teamsubmission) {
            if (scope.userSubmission && scope.userSubmission.status != mmaModAssignSubmissionStatusNew) {
                scope.statusTranslated = $translate.instant('mma.mod_assign.submissionstatus_' + scope.userSubmission.status);
                scope.statusClass = $mmaModAssign.getSubmissionStatusClass(scope.userSubmission.status);
            } else {
                if (!status.lastattempt.submissionsenabled) {
                    scope.statusTranslated = $translate.instant('mma.mod_assign.noonlinesubmissions');
                    scope.statusClass = $mmaModAssign.getSubmissionStatusClass('noonlinesubmissions');
                } else {
                    scope.statusTranslated = $translate.instant('mma.mod_assign.noattempt');
                    scope.statusClass = $mmaModAssign.getSubmissionStatusClass('noattempt');
                }
            }
        } else {
            if (!status.lastattempt.submissiongroup && assign.preventsubmissionnotingroup) {
                scope.statusTranslated = $translate.instant('mma.mod_assign.nosubmission');
                scope.statusClass = $mmaModAssign.getSubmissionStatusClass('nosubmission');
            } else if (scope.userSubmission && scope.userSubmission.status != mmaModAssignSubmissionStatusNew) {
                scope.statusTranslated = $translate.instant('mma.mod_assign.submissionstatus_' + scope.userSubmission.status);
                scope.statusClass = $mmaModAssign.getSubmissionStatusClass(scope.userSubmission.status);
            } else {
                if (!status.lastattempt.submissionsenabled) {
                    scope.statusTranslated = $translate.instant('mma.mod_assign.noonlinesubmissions');
                    scope.statusClass = $mmaModAssign.getSubmissionStatusClass('noonlinesubmissions');
                } else {
                    scope.statusTranslated = $translate.instant('mma.mod_assign.nosubmission');
                    scope.statusClass = $mmaModAssign.getSubmissionStatusClass('nosubmission');
                }
            }
        }
    }

    /**
     * Convenience function to minimize and split the controller having all feedback info here.
     *
     * @param {Object} scope            Directive scope.
     * @param {Object} assign           Assignment.
     * @param {Object} feedbackStatus   Submission feedback status.
     * @param {Number} courseId         Course Id.
     * @param {Number} moduleId         Module Id.
     * @param {Number} userId           User Id.
     * @return {Promise}          Resolved when controller finish.
     */
    function feedbackController(scope, assign, feedbackStatus, courseId, moduleId, userId) {
        scope.grade = {
            method: false,
            grade: false,
            gradingStatus: false,
            addAttempt : false,
            applyToAll: false,
            scale: false,
            lang: false
        };

        if (feedbackStatus) {
            scope.feedback = feedbackStatus;
            if (feedbackStatus.grade && feedbackStatus.grade.grader) {
                $mmUser.getProfile(feedbackStatus.grade.grader, courseId).then(function(profile) {
                    scope.grader = profile;
                });
            }

            if (feedbackStatus.gradefordisplay) {
                var position = feedbackStatus.gradefordisplay.indexOf('class="advancedgrade"');
                if (position > -1) {
                    scope.feedback.advancedgrade = true;
                }
            }

            // Do not override already loaded grade.
            if (feedbackStatus.grade && feedbackStatus.grade.grade && !scope.grade.grade) {
                scope.grade.grade = parseFloat(feedbackStatus.grade.grade);
            }
        } else {
            // If no feedback, always show Submission.
            scope.showSubmission = true;
        }

        scope.grade.gradingStatus = scope.gradingStatus;

        return $mmaModAssign.isGradingEnabled().then(function(enabled) {
            if (enabled) {
                return $mmCourse.getModuleBasicGradeInfo(moduleId).then(function(gradeInfo) {
                    if (gradeInfo) {

                        scope.gradeInfo = gradeInfo;
                        if (gradeInfo.advancedgrading && gradeInfo.advancedgrading[0] &&
                                typeof gradeInfo.advancedgrading[0].method != 'undefined') {
                            scope.grade.method = gradeInfo.advancedgrading[0].method || 'simple';
                        } else {
                            scope.grade.method = 'simple';
                        }
                        scope.isGrading = true;

                        // Grades can be saved if simple grading.
                        scope.canSaveGrades = scope.grade.method == 'simple';

                        if (scope.gradeInfo.scale) {
                            scope.grade.scale = formatScaleOptions(scope.gradeInfo.scale, $translate.instant('mm.core.nograde'));
                        } else {
                            // Get current language to format grade input field.
                            $mmLang.getCurrentLanguage().then(function(lang) {
                                scope.grade.lang = lang;
                            });
                        }

                        if ($mmaModAssign.isOutcomesEditEnabled()) {
                            angular.forEach(scope.gradeInfo.outcomes, function(outcome) {
                                if (outcome.scale) {
                                    outcome.options =
                                        formatScaleOptions(outcome.scale, $translate.instant('mma.grades.nooutcome'));
                                }
                                outcome.selectedId = 0;
                            });
                        }

                        // Get grade addon if avalaible.
                        var $mmaGrades = $mmAddonManager.get('$mmaGrades');
                        if (!$mmaGrades) {
                            return $q.when();
                        }

                        return $mmaGrades.getGradeModuleItems(courseId, moduleId, userId).then(function(grades) {
                            var outcomes = {};
                            angular.forEach(grades, function(grade) {
                                if (!grade.outcomeid && !grade.scaleid) {
                                    if (scope.grade.scale) {
                                        scope.grade.grade = getSelectedScaleId(scope.grade.scale, grade.gradeformatted);
                                    } else {
                                        scope.grade.grade = parseFloat(grade.gradeformatted);
                                    }
                                } else if (grade.outcomeid) {
                                    // Only show outcomes with info on it outcomeid could be null if outcomes are disabled on site.
                                    angular.forEach(scope.gradeInfo.outcomes, function(outcome) {
                                        if (outcome.id == grade.outcomeid) {
                                            outcome.selected = grade.gradeformatted;
                                            if (outcome.options) {
                                                outcome.selectedId = getSelectedScaleId(outcome.options, outcome.selected);
                                                outcome.itemNumber = grade.itemnumber;
                                            }
                                            outcomes[outcome.id] = outcome;
                                        }
                                    });
                                }
                            });
                            scope.gradeInfo.outcomes = outcomes;
                        });
                    }
                }).then(function() {
                    var isManual = assign.attemptreopenmethod == mmaModAssignAttemptReopenMethodManual,
                        isUnlimited = assign.maxattempts == mmaModAssignUnlimitedAttempts,
                        isLessThanMaxAttempts = scope.userSubmission &&
                            (scope.userSubmission.attemptnumber < (assign.maxattempts - 1));

                    scope.allowAddAttempt = isManual && (!scope.userSubmission || isUnlimited || isLessThanMaxAttempts);

                    if (assign.teamsubmission) {
                        scope.grade.applyToAll = true;
                    }
                    if (assign.markingworkflow && scope.grade.gradingStatus) {
                        scope.workflowStatusTranslationId =  getSubmissionGradingStatusTranslationId(scope.grade.gradingStatus);
                    }

                    if (!scope.feedback) {
                        scope.feedback = {};

                        // Feedback plugins not present, we have to use assign configs to detect the plugins used.
                        scope.feedback.plugins = $mmaModAssignHelper.getPluginsEnabled(assign, 'assignfeedback');
                    }
                });
            }
        });
    }

    // Convenience function to format scale selectors options.
    function formatScaleOptions(options, defaultOption) {
        options = options.split(",");
        options = options.map(function (value) {return value.trim();});
        options.unshift(defaultOption);
        return options;
    }

    // Convenience function to get scale selected option.
    function getSelectedScaleId(options, selected) {
        var index = options.indexOf(selected) || 0;
        if (index < 0) {
            return 0;
        }
        return index;
    }

    // Directive controller.
    function controller() {
        var self = this;

        self.load = function(scope, moduleId, courseId, submitId, blindId) {
            var isBlind = !!blindId,
                assign;

            if (!submitId) {
                submitId = $mmSite.getUserId();
                isBlind = false;
            }

            return $mmaModAssign.getAssignment(courseId, moduleId).then(function(assignData) {
                assign = assignData;

                var time = parseInt(Date.now() / 1000),
                    promises = [];

                scope.assign = assign;

                if (assign.allowsubmissionsfromdate && assign.allowsubmissionsfromdate >= time) {
                    scope.fromDate = moment(assign.allowsubmissionsfromdate * 1000)
                        .format($translate.instant('mm.core.dfmediumdate'));
                }
                scope.currentAttempt = 0;
                scope.attemptReopenMethodNone = mmaModAssignAttemptReopenMethodNone;
                scope.unlimitedAttempts = mmaModAssignUnlimitedAttempts;
                scope.blindMarking = scope.isSubmittedForGrading && assign.blindmarking && !assign.revealidentities;

                if (!scope.blindMarking && submitId != $mmSite.getUserId()) {
                    promises.push($mmUser.getProfile(submitId, courseId).then(function(profile) {
                        scope.user = profile;
                    }));
                }

                // Check if there's any offline data for this submission.
                promises.push($mmaModAssignOffline.getSubmission(assign.id, submitId).then(function(data) {
                    scope.hasOffline = data && data.plugindata && Object.keys(data.plugindata).length;
                    scope.submittedOffline = data && data.submitted;
                }).catch(function() {
                    // No offline data found.
                    scope.hasOffline = false;
                    scope.submittedOffline = false;
                }));

                return $q.all(promises);
            }).then(function() {
                // Get submission status.
                return $mmaModAssign.getSubmissionStatus(assign.id, submitId, isBlind).then(function(response) {
                    var promises = [],
                        submissionStatementMissing = assign.requiresubmissionstatement &&
                            typeof assign.submissionstatement == 'undefined';

                    scope.submissionStatusAvailable = true;

                    scope.lastAttempt = response.lastattempt;
                    scope.previousAttempts = response.previousattempts;
                    scope.membersToSubmit = [];
                    if (response.lastattempt) {
                        scope.canSubmit = !scope.isSubmittedForGrading && !scope.submittedOffline &&
                            (response.lastattempt.cansubmit ||
                                (scope.hasOffline && $mmaModAssign.canSubmitOffline(assign, response)));
                        scope.canEdit = !scope.isSubmittedForGrading && response.lastattempt.canedit &&
                                (!scope.submittedOffline || !assign.submissiondrafts);

                        // Get submission statement if needed.
                        if (assign.requiresubmissionstatement && assign.submissiondrafts && submitId == $mmSite.getUserId()) {
                            scope.submissionStatement = assign.submissionstatement;
                            scope.submitModel.submissionStatement = false;
                        } else {
                            scope.submissionStatement = false;
                            scope.submitModel.submissionStatement = true; // No submission statement, so it's accepted.
                        }

                        // Show error instead of edit/submit button if submission statement should be shown
                        // but we couldn't retrieve it from server (Moodle 3.1 or previous).
                        scope.showErrorStatementEdit = submissionStatementMissing && !assign.submissiondrafts &&
                                submitId == $mmSite.getUserId();
                        scope.showErrorStatementSubmit = submissionStatementMissing && assign.submissiondrafts;

                        scope.userSubmission = $mmaModAssign.getSubmissionObjectFromAttempt(assign, response.lastattempt);

                        if (assign.attemptreopenmethod != mmaModAssignAttemptReopenMethodNone) {
                            if (scope.userSubmission) {
                                scope.currentAttempt = scope.userSubmission.attemptnumber + 1;
                            }
                        }

                        setStatusNameAndClass(scope, assign, response);

                        if (assign.teamsubmission) {
                            if (response.lastattempt.submissiongroup) {
                                promises.push($mmGroups.getActivityAllowedGroups(assign.cmid).then(function(groups) {
                                    angular.forEach(groups, function(group) {
                                        if (group.id == response.lastattempt.submissiongroup) {
                                            scope.lastAttempt.submissiongroupname = group.name;
                                        }
                                    });
                                }));
                            }

                            if (scope.userSubmission && scope.userSubmission.status != mmaModAssignSubmissionStatusNew) {
                                scope.userStateName = mmUserProfileState;

                                angular.forEach(response.lastattempt.submissiongroupmemberswhoneedtosubmit, function(member) {
                                    if (scope.blindMarking) {
                                        // Users not blinded! (Moodle < 3.1.1, 3.2)
                                        promises.push($mmaModAssign.getAssignmentUserMappings(assign.id, member).then(function(blindId) {
                                            scope.membersToSubmit.push(blindId);
                                        }).catch(function() {
                                            // Fail silently (Moodle < 2.6)
                                        }));
                                    } else {
                                        promises.push($mmUser.getProfile(member, courseId).then(function(profile) {
                                            scope.membersToSubmit.push(profile);
                                        }));
                                    }
                                });
                                angular.forEach(response.lastattempt.submissiongroupmemberswhoneedtosubmitblind, function(member) {
                                    scope.membersToSubmit.push(member);
                                });
                            }
                        }

                        scope.gradingStatusTranslationId =
                                    $mmaModAssign.getSubmissionGradingStatusTranslationId(response.lastattempt.gradingstatus);
                        scope.gradingClass = $mmaModAssign.getSubmissionGradingStatusClass(response.lastattempt.gradingstatus);

                        if (scope.userSubmission) {
                            if (!assign.teamsubmission || !response.lastattempt.submissiongroup ||
                                    !assign.preventsubmissionnotingroup) {
                                scope.submissionPlugins = scope.userSubmission.plugins;
                            }
                        }
                    }

                    if (assign.duedate > 0) {
                        var duedate = response.lastattempt && response.lastattempt.extensionduedate ?
                            response.lastattempt.extensionduedate: assign.duedate,
                            time = parseInt(Date.now() / 1000);
                            timeRemaining = duedate - time;
                        if (timeRemaining <= 0) {
                            if (!scope.userSubmission || scope.userSubmission.status != mmaModAssignSubmissionStatusSubmitted) {
                                if ((response.lastattempt && response.lastattempt.submissionsenabled) ||
                                    (response.gradingsummary && response.gradingsummary.submissionsenabled)) {
                                    scope.timeRemaining = $translate.instant('mma.mod_assign.overdue',
                                        {'$a': $mmUtil.formatDuration(-timeRemaining, 3) });
                                    scope.timeRemainingClass = 'overdue';
                                } else {
                                    scope.timeRemaining = $translate.instant('mma.mod_assign.duedatereached');
                                }
                            } else {
                                var timeSubmittedDiff = scope.userSubmission.timemodified - duedate;
                                if (timeSubmittedDiff > 0) {
                                    scope.timeRemaining = $translate.instant('mma.mod_assign.submittedlate',
                                        {'$a': $mmUtil.formatDuration(timeSubmittedDiff, 2) });
                                    scope.timeRemainingClass = 'latesubmission';
                                } else {
                                    scope.timeRemaining = $translate.instant('mma.mod_assign.submittedearly',
                                        {'$a': $mmUtil.formatDuration(-timeSubmittedDiff, 2) });
                                    scope.timeRemainingClass = 'earlysubmission';
                                }
                            }
                        } else {
                            scope.timeRemaining = $mmUtil.formatDuration(timeRemaining, 3);
                        }
                    }

                    promises.push(feedbackController(scope, assign, response.feedback, courseId, moduleId, submitId));

                    // Check if there's any unsupported plugin for editing.
                    if (!scope.userSubmission) {
                        scope.userSubmission = {};
                        // Submission not created yet, we have to use assign configs to detect the plugins used.
                        scope.userSubmission.plugins = $mmaModAssignHelper.getPluginsEnabled(assign, 'assignsubmission');
                    }

                    promises.push($mmaModAssign.getUnsupportedEditPlugins(scope.userSubmission.plugins).then(function(list) {
                        scope.unsupportedEditPlugins = list;
                    }));

                    return $q.all(promises);
                }).catch(function(error) {
                    if (typeof error != "undefined") {
                        if (error == 'error/nopermission') {
                            $mmUtil.showModal('mm.core.notice', 'mma.mod_assign.errorshowinginformation');
                            return $q.when();
                        }
                        return $q.reject(error);
                    }

                    // Fallback. Legacy code ahead.
                    if (assign.duedate > 0) {
                        var time = parseInt(Date.now() / 1000);
                        if (assign.duedate - time <= 0) {
                            scope.timeRemaining = $translate.instant('mma.mod_assign.duedatereached');
                        } else {
                            scope.timeRemaining = $mmUtil.formatDuration(assign.duedate - time, 3);
                        }
                    }

                    return $mmaModAssign.getSubmissions(assign.id).then(function(data) {
                        scope.canSubmit = !data.canviewsubmissions;

                        if (data.submissions) {
                            scope.userSubmission = false;
                            angular.forEach(data.submissions, function(submission) {
                                if (submission.userid == submitId) {
                                    scope.userSubmission = submission;
                                    scope.statusTranslated = $translate.instant('mma.mod_assign.submissionstatus_' +
                                        submission.status);
                                    scope.statusClass = $mmaModAssign.getSubmissionStatusClass(submission.status);
                                    scope.currentAttempt = scope.userSubmission.attemptnumber + 1;
                                    scope.submissionPlugins = submission.plugins;
                                }
                            });
                        }
                    });
                });
            }).catch(function(message) {
                if (message) {
                    $mmUtil.showErrorModal(message);
                } else {
                    $mmUtil.showErrorModal('Error getting assigment data.');
                }
                return $q.reject();
            }).finally(function() {
                scope.loaded = true;
            });
        };
    }

    return {
        scope: {
            courseid: '@',
            moduleid: '@',
            submitid: '@?',
            blindid: '@?',
            scrollHandle: '@?',
            showSubmission: '@?'
        },
        restrict: 'E',
        controller: controller,
        templateUrl: 'addons/mod/assign/templates/submission.html',
        link: function(scope, element, attributes, controller) {
            var moduleId = parseInt(attributes.moduleid, 10),
                courseId = parseInt(attributes.courseid, 10),
                submitId = parseInt(attributes.submitid, 10),
                blindId = parseInt(attributes.blindid, 10),
                obsInvalidated, obsManualSync;

            scope.isSubmittedForGrading = !!submitId;
            scope.statusNew = mmaModAssignSubmissionStatusNew;
            scope.statusReopened = mmaModAssignSubmissionStatusReopened;
            scope.showSubmission = typeof attributes.showSubmission != 'undefined' ? attributes.showSubmission : true;
            scope.submitId = submitId;
            scope.courseId = courseId;
            scope.blindId = blindId;
            scope.loaded = false;
            scope.submitModel = {};

            obsInvalidated = scope.$on(mmaModAssignSubmissionInvalidatedEvent, function() {
                invalidateAndRefresh();
            });

            obsManualSync = $mmEvents.on(mmaModAssignEventManualSynced, function(data) {
                if (data && scope.assign && data.siteid == $mmSite.getId() && data.assignid == scope.assign.id) {
                    controller.load(scope, moduleId, courseId, submitId, blindId);
                }
            });

            // Check if submit through app is supported.
            $mmaModAssign.isSaveAndSubmitSupported().then(function(enabled) {
                scope.submitSupported = enabled;
            });

            scope.$on('$destroy', function() {
                obsInvalidated && obsInvalidated();
                obsManualSync && obsManualSync.off && obsManualSync.off();
            });

            controller.load(scope, moduleId, courseId, submitId, blindId);

            // Add or edit submission.
            scope.goToEdit = function() {
                $state.go('site.mod_assign-submission-edit', {
                    moduleid: moduleId,
                    courseid: courseId,
                    userid: submitId,
                    blindid: blindId
                });
            };

            // Copy previous attempt and then go to edit.
            scope.copyPrevious = function() {
                if (!$mmApp.isOnline()) {
                    $mmUtil.showErrorModal('mm.core.networkerrormsg', true);
                    return;
                }

                if (!scope.previousAttempts || !scope.previousAttempts.length) {
                    // Cannot access previous attempts, just go to edit.
                    scope.goToEdit();
                    return;
                }

                var modal = $mmUtil.showModalLoading(),
                    previousAttempt = scope.previousAttempts[scope.previousAttempts.length - 1],
                    previousSubmission = $mmaModAssign.getSubmissionObjectFromAttempt(scope.assign, previousAttempt);

                $mmaModAssignHelper.getSubmissionSizeForCopy(scope.assign, previousSubmission).catch(function() {
                    // Error calculating size, return -1.
                    return -1;
                }).then(function(size) {
                    modal.dismiss();

                    // Confirm action.
                    return $mmFileUploaderHelper.confirmUploadFile(size, true);
                }).then(function() {
                    // User confirmed, copy the attempt.
                    modal = $mmUtil.showModalLoading('mm.core.sending', true);

                    $mmaModAssignHelper.copyPreviousAttempt(scope.assign, previousSubmission).then(function() {
                        // Now go to edit.
                        scope.goToEdit();

                        // Invalidate and refresh data to update this view.
                        invalidateAndRefresh();

                        if (!scope.assign.submissiondrafts) {
                            // No drafts allowed, so it was submitted. Trigger event.
                            $mmEvents.trigger(mmaModAssignSubmittedForGradingEvent, {
                                assignmentId: scope.assign.id,
                                submissionId: scope.userSubmission.id,
                                userId: $mmSite.getUserId(),
                                siteId: $mmSite.getId()
                            });
                        }
                    }).catch(function(err) {
                        alert(err);
                    }).finally(function() {
                        modal.dismiss();
                    });
                });
            };

            // Show advanced grade action.
            scope.showAdvancedGrade = function() {
                if (scope.feedback.advancedgrade) {
                    $mmText.expandText($translate.instant('mma.grades.grade'), scope.feedback.gradefordisplay, false,
                            mmaModAssignComponent, moduleId);
                }
            };

            // Change between submission and feedback view.
            scope.changeShowSubmission = function(show) {
                scope.showSubmission = show;
            };

            // Submit grade action.
            scope.submitGrade = function() {
                if (!scope.canSaveGrades) {
                    return;
                }

                var attemptNumber = scope.userSubmission ? scope.userSubmission.attemptnumber : -1,
                    outcomes = {},
                    modal,
                    pluginPromise,
                    // Scale "no grade" uses -1 instead of 0.
                    grade = scope.grade.scale && scope.grade.grade == 0 ? -1 : $mmUtil.unformatFloat(scope.grade.grade);

                if (grade === false) {
                    $mmUtil.showErrorModal('mma.grades.badgrade', true);
                    return $q.reject();
                }

                modal = $mmUtil.showModalLoading('mm.core.sending', true);

                angular.forEach(scope.gradeInfo.outcomes, function(outcome) {
                    if (outcome.itemNumber) {
                        outcomes[outcome.itemNumber] = outcome.selectedId;
                    }
                });

                if (scope.feedback && scope.feedback.plugins) {
                    pluginPromise = $mmaModAssignHelper.prepareFeedbackPluginData(scope.assign.id, submitId, scope.feedback);
                } else {
                    pluginPromise = $q.when({});
                }

                return pluginPromise.then(function(pluginData) {
                    return $mmaModAssign.submitGradingForm(scope.assign.id, submitId, grade, attemptNumber, scope.grade.addAttempt,
                            scope.grade.gradingStatus, scope.grade.applyToAll, outcomes, pluginData).then(function() {

                        var promise;
                        if (scope.feedback && scope.feedback.plugins) {
                            promise = $mmaModAssignHelper.discardFeedbackPluginData(scope.assign.id, submitId, scope.feedback);
                        } else {
                            promise = $q.when();
                        }
                        promise.finally(function() {
                            // Invalidate and refresh data.
                            invalidateAndRefresh();
                        });
                    });
                }).catch(function(error) {
                    $mmUtil.showErrorModal(error);
                }).finally(function() {
                    modal.dismiss();
                });
            };

            // Submit for grading.
            scope.submit = function(acceptStatement) {
                if (scope.assign.requiresubmissionstatement && !acceptStatement) {
                    $mmUtil.showErrorModal('mma.mod_assign.acceptsubmissionstatement', true);
                    return $q.reject();
                }

                // Ask for confirmation. @todo plugin precheck_submission
                $mmUtil.showConfirm($translate('mma.mod_assign.confirmsubmission')).then(function() {

                    var modal = $mmUtil.showModalLoading('mm.core.sending', true);

                    $mmaModAssign.submitForGrading(scope.assign.id, courseId, acceptStatement,
                                scope.userSubmission.timemodified, scope.hasOffline).then(function() {
                        // Invalidate and refresh data.
                        invalidateAndRefresh();

                        // Submitted, trigger event.
                        $mmEvents.trigger(mmaModAssignSubmittedForGradingEvent, {
                            assignmentId: scope.assign.id,
                            submissionId: scope.userSubmission.id,
                            userId: $mmSite.getUserId(),
                            siteId: $mmSite.getId()
                        });
                    }).catch(function(error) {
                        $mmUtil.showErrorModal(error);
                    }).finally(function() {
                        modal.dismiss();
                    });
                });
            };

            // Invalidate and refresh data.
            function invalidateAndRefresh() {
                scope.loaded = false;

                var promises = [$mmaModAssign.invalidateAssignmentData(courseId)];
                if (scope.assign) {
                    promises.push($mmaModAssign.invalidateSubmissionStatusData(scope.assign.id, submitId, !!blindId));
                    promises.push($mmaModAssign.invalidateAssignmentUserMappingsData(scope.assign.id));
                }
                // Get grade addon if avalaible.
                var $mmaGrades = $mmAddonManager.get('$mmaGrades');
                if ($mmaGrades) {
                    promises.push($mmaGrades.invalidateGradeItemsData(courseId, submitId));
                }
                promises.push($mmCourse.invalidateModule(moduleId));

                return $q.all(promises).finally(function() {
                    return controller.load(scope, moduleId, courseId, submitId, blindId);
                });
            }
        }
    };
});
