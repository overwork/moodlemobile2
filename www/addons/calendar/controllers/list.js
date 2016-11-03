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

angular.module('mm.addons.calendar')

/**
 * Controller to handle calendar events.
 *
 * @module mm.addons.calendar
 * @ngdoc controller
 * @name mmaCalendarListCtrl
 */
.controller('mmaCalendarListCtrl', function($scope, $stateParams, $log, $cordovaCalendar, $timeout, $state, $mmaCalendar, $mmUtil, $ionicHistory,
        mmaCalendarDaysInterval) {

    $log = $log.getInstance('mmaCalendarListCtrl');

    var daysLoaded,
        emptyEventsTimes; // Variable to identify consecutive calls returning 0 events.

    if ($stateParams.eventid) {
        // We arrived here via notification click, let's clear history and redirect to event details.
        $ionicHistory.clearHistory();
        $state.go('site.calendar-event', {id: $stateParams.eventid});
    }

    // Convenience function to initialize variables.
    function initVars() {
        daysLoaded = 0;
        emptyEventsTimes = 0;
        $scope.events = [];
    }

    // Convenience function that fetches the events and updates the scope.
    function fetchEvents(refresh) {
        if (refresh) {
            initVars();
        }
        $scope.canLoadMore = false; // Set it to false to prevent consecutive calls.

        return $mmaCalendar.getEvents(daysLoaded, mmaCalendarDaysInterval, refresh).then(function(events) {
            daysLoaded += mmaCalendarDaysInterval;

            if (events.length === 0) {
                emptyEventsTimes++;
                if (emptyEventsTimes > 5) { // Stop execution if we retrieve empty list 6 consecutive times.
                    $scope.canLoadMore = false;
                    $scope.eventsLoaded = true;
                } else {
                    // No events returned, load next events.
                    return fetchEvents();
                }
            } else {
                angular.forEach(events, $mmaCalendar.formatEventData);
                if (refresh) {
                    $scope.events = events;
                } else {
                    $scope.events = $scope.events.concat(events);
                }
                $scope.count = $scope.events.length;
                $scope.eventsLoaded = true;
                $scope.canLoadMore = true;

                // Schedule notifications for the events retrieved (might have new events).
                $mmaCalendar.scheduleEventsNotifications(events);
            }
        }, function(error) {
            if (error) {
                $mmUtil.showErrorModal(error);
            } else {
                $mmUtil.showErrorModal('mma.calendar.errorloadevents', true);
            }
            $scope.eventsLoaded = true;
        });
    }

    initVars();
    $scope.count = 0;

    // Get first events.
    fetchEvents();

    // Load more events.
    $scope.loadMoreEvents = function() {
        fetchEvents().finally(function() {
            $scope.$broadcast('scroll.infiniteScrollComplete');
        });
    };

    // Pull to refresh.
    $scope.refreshEvents = function() {
        $mmaCalendar.invalidateEventsList().finally(function() {
            fetchEvents(true).finally(function() {
                $scope.$broadcast('scroll.refreshComplete');
            });
        });
    };

    $scope.addEvent = function(event,idx) {
        console.log("add ", event);

        if(event.timestart == (event.timestart + event.timeduration)){
            event.timeduration += 900;
            console.log("START END SAME TIME: add duration 15: ", event.timeduration);

        }else{
            console.log("START END DIFFERENT TIME");
        }

        console.log("start ", event.timestart);
        console.log("end ", event.timestart + event.timeduration);


        $scope.startDate = new Date(event.timestart * 1000);
        $scope.endDate = new Date((event.timestart + event.timeduration) * 1000);
        console.log("Start date: ", $scope.startDate);
        console.log("End date: ", $scope.endDate);

        $cordovaCalendar.createCalendar({
            calendarName: 'Moodle Calendar',
            calendarColor: '#ff8c00'
        }).then(function (result) {
            // success
        }, function (err) {
            // error
        });

        $cordovaCalendar.createEventInNamedCalendar({
            title: event.name,
            notes: event.description,
            startDate: $scope.startDate,
            endDate: $scope.endDate,
            calendarName: 'Moodle Calendar'
        }).then(function (result) {
            // success
        }, function (err) {
            // error
        });

    };
});
