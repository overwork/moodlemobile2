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
.controller('mmaCalendarListCtrl', function($scope, $stateParams, $q, $log, $cordovaCalendar, $timeout, $state, $mmaCalendar, $mmUtil, $ionicHistory,
        mmaCalendarDaysInterval) {

    $log = $log.getInstance('mmaCalendarListCtrl');
    $scope.syncSpecificEvent = false;
    $scope.eventsToSync = [];
    $scope.events

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
        findAllEvents();
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
        findAllEvents();
    };

    $scope.syncAllEvents = function(events) {
        var promises = [];
        console.log("Sync all events: ", events);
        $scope.eventsToSync = events;

        angular.forEach($scope.eventsToSync, function (event) {
           var promise = $mmaCalendar.syncEventToLocalCalendar(event).then(function (result) {
                console.log("done adding event, result is " + result);
                if (result === 1) {
                    console.log("success");
                    //update event
                } else {
                    console.log("error");
                }
            });
            promises.push(promise);
       });
        $q.all(promises).then(function () {
            console.log("All events has been synced");
        });
    };


    $scope.syncSpecific = function() {
        if($scope.syncSpecificEvent == false){
            $scope.syncSpecificEvent = true;
        }else{
            $scope.syncSpecificEvent = false;
        }

    };

    $scope.addEvent = function(event) {
        console.log("add ", event);
        $scope.eventsToSync = event;

        $mmaCalendar.syncEventToLocalCalendar($scope.eventsToSync).then(function(result) {
            console.log("done adding event, result is "+result);
            if(result === 1) {
                event.status = 1;
                console.log("success");
            } else {
                console.log("error");
                //For now... maybe just tell the user it didn't work?
            }
        });



    };
    $scope.findAllEvents = function() {

        $cordovaCalendar.findAllEventsInNamedCalendar('Moodle Calendar').then(function (result) {
            console.log(result);
        }, function (err) {
            // error
        });

    };
});
