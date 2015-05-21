'use strict';

var inherits = require('inherits');

var assign = require('lodash/object/assign');

var CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');

var getApproxIntersection = require('diagram-js/lib/util/LineIntersection').getApproxIntersection;


function copy(obj) {
  return assign({}, obj);
}

function CreateOnFlowBehavior(eventBus, bpmnRules, modeling) {

  CommandInterceptor.call(this, eventBus);

  /**
   * Reconnect start / end of a connection after
   * dropping an element on a flow.
   */

  this.preExecute('shape.create', function(context) {

    var parent = context.parent,
        shape = context.shape;

    if (bpmnRules.canInsert(shape, parent)) {
      context.insertTarget = parent;
      context.parent = parent.parent;
    }
  }, true);


  this.postExecute('shape.create', function(context) {

    var shape = context.shape,
        insertTarget = context.insertTarget,
        position = context.position,
        source,
        target,
        reconnected,
        intersection,
        waypoints,
        waypointsBefore,
        waypointsAfter,
        dockingPoint;

    if (insertTarget) {

      waypoints = insertTarget.waypoints;


      intersection = getApproxIntersection(waypoints, position);

      if (intersection) {
        waypointsBefore = waypoints.slice(0, intersection.index);
        waypointsAfter = waypoints.slice(intersection.index + (intersection.bendpoint ? 1 : 0));

        dockingPoint = intersection.bendpoint ? waypoints[intersection.index] : position;

        waypointsBefore.push(copy(dockingPoint));
        waypointsAfter.unshift(copy(dockingPoint));
      }

      source = insertTarget.source;
      target = insertTarget.target;

      if (bpmnRules.canConnect(source, shape, insertTarget)) {
        // reconnect source -> inserted shape
        modeling.reconnectEnd(insertTarget, shape, waypointsBefore || copy(position));

        reconnected = true;
      }

      if (bpmnRules.canConnect(shape, target, insertTarget)) {

        if (!reconnected) {
          // reconnect inserted shape -> end
          modeling.reconnectStart(insertTarget, shape, waypointsAfter || copy(position));
        } else {
          modeling.connect(shape, target, { type: insertTarget.type, waypoints: waypointsAfter });
        }
      }
    }
  }, true);
}

inherits(CreateOnFlowBehavior, CommandInterceptor);

CreateOnFlowBehavior.$inject = [ 'eventBus', 'bpmnRules', 'modeling' ];

module.exports = CreateOnFlowBehavior;