/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {LegacyDispatcher, Replayer} from '../src/legacy_dispatcher';
import {
  ActionInfo,
  createEventInfo,
  EventInfo,
  EventInfoWrapper,
  unsetAction,
} from '../src/event_info';

function createClickEvent() {
  return new MouseEvent('click', {bubbles: true, cancelable: true});
}

function createTestActionInfo({
  name = 'foo.bar',
  element = document.createElement('div'),
} = {}): ActionInfo {
  return {name, element};
}

function createTestEventInfo({
  eventType = 'click',
  event = createClickEvent(),
  targetElement = document.createElement('div'),
  container = document.createElement('div'),
  timestamp = 0,
  action = createTestActionInfo(),
  isReplay = undefined,
}: {
  eventType?: string;
  event?: Event;
  targetElement?: Element;
  container?: Element;
  timestamp?: number;
  action?: ActionInfo;
  isReplay?: boolean;
} = {}): EventInfo {
  return createEventInfo({
    event,
    eventType,
    targetElement,
    container,
    timestamp,
    action,
    isReplay,
  });
}

describe('dispatcher test.ts', () => {
  it('dispatches to registered EventInfo handler', () => {
    const actionElement = document.createElement('div');

    let eventInfo!: EventInfoWrapper;
    const actionHandler = (event: EventInfoWrapper) => {
      eventInfo = event;
    };

    const dispatcher = new LegacyDispatcher();
    const actions = {'bar': actionHandler};
    dispatcher.registerEventInfoHandlers('foo', null, actions);

    dispatcher.dispatch(
      createTestEventInfo({
        action: createTestActionInfo({element: actionElement}),
      }),
    );
    expect(eventInfo).not.toBeNull();
    expect(eventInfo.getEventType()).toBe('click');
    expect(eventInfo.getAction()!.element).toBe(actionElement);
  });

  it('dispatches preferentially to delegated EventInfo handler', () => {
    const actionElement = document.createElement('div');

    const eventInfoHandler1 = jasmine.createSpy('eventInfoHandler1');
    const getEventInfoHandler = () => eventInfoHandler1;
    const eventInfoHandler2 = jasmine.createSpy('eventInfoHandler2');

    const dispatcher = new LegacyDispatcher(/* getHandler= */ getEventInfoHandler);
    const eventInfoHandlers = {'bar': eventInfoHandler2};
    dispatcher.registerEventInfoHandlers('bar', null, eventInfoHandlers);

    dispatcher.dispatch(
      createTestEventInfo({
        action: createTestActionInfo({element: actionElement}),
      }),
    );
    expect(eventInfoHandler1).toHaveBeenCalled();
    expect(eventInfoHandler2).not.toHaveBeenCalled();
  });

  it('registered EventInfo handlers are found with hasAction', () => {
    const dispatcher = new LegacyDispatcher();

    dispatcher.registerEventInfoHandlers('', null, {
      'foo': () => {},
      'bar': () => {},
    });
    expect(dispatcher.hasAction('foo')).toBe(true);
    expect(dispatcher.hasAction('bar')).toBe(true);
    expect(dispatcher.hasAction('baz')).toBe(false);
  });

  it('EventInfo handlers can be unregistered', () => {
    const dispatcher = new LegacyDispatcher();

    dispatcher.registerEventInfoHandlers('prefix', null, {
      'clickaction': () => {},
    });
    dispatcher.registerEventInfoHandlers('', null, {'fooaction': () => {}});
    expect(dispatcher.hasAction('prefix.clickaction')).toBe(true);
    expect(dispatcher.hasAction('fooaction')).toBe(true);

    dispatcher.unregisterHandler('prefix', 'clickaction');
    expect(dispatcher.hasAction('prefix.clickaction')).toBe(false);

    dispatcher.unregisterHandler('', 'fooaction');
    expect(dispatcher.hasAction('fooaction')).toBe(false);
  });

  async function waitForEventReplayer(eventReplayer: jasmine.Spy) {
    await new Promise((resolve) => {
      eventReplayer.and.callFake(resolve);
    });
  }

  it('global event dispatch is not replayed', async () => {
    const dispatcher = new LegacyDispatcher();
    const eventReplayer = jasmine.createSpy('eventReplayer');
    dispatcher.setEventReplayer(eventReplayer);
    dispatcher.registerEventInfoHandlers('foo', null, {'bar': () => {}});
    const replayed = waitForEventReplayer(eventReplayer);

    await expectAsync(replayed).toBePending();

    const eventInfo1 = createTestEventInfo({isReplay: true});
    unsetAction(eventInfo1);
    dispatcher.dispatch(eventInfo1);

    await expectAsync(replayed).toBePending();
  });

  function expectEventReplayerToHaveBeenCalledWith(
    eventReplayer: jasmine.Spy<Replayer>,
    expectedEventInfos: EventInfo[],
    expectedDispatcher: LegacyDispatcher,
  ) {
    const args = eventReplayer.calls.mostRecent().args;
    expect(args.length).toBe(2);
    const [eventInfoWrappers, dispatcher] = args;
    expect(eventInfoWrappers.map((eventInfoWrapper) => eventInfoWrapper.eventInfo)).toEqual(
      expectedEventInfos,
    );
    expect(dispatcher).toBe(expectedDispatcher);
  }

  it('events are collected and replayed', async () => {
    const dispatcher = new LegacyDispatcher();
    const eventReplayer = jasmine.createSpy<Replayer>('eventReplayer');
    dispatcher.setEventReplayer(eventReplayer);
    dispatcher.registerEventInfoHandlers('foo', null, {'bar': () => {}});
    const replayed = waitForEventReplayer(eventReplayer);

    await expectAsync(replayed).toBePending();

    const eventInfo1 = createTestEventInfo({isReplay: true});
    const eventInfo2 = createTestEventInfo({isReplay: true});
    dispatcher.dispatch(eventInfo1);
    dispatcher.dispatch(eventInfo2);

    await expectAsync(replayed).toBeResolved();
    expectEventReplayerToHaveBeenCalledWith(eventReplayer, [eventInfo1, eventInfo2], dispatcher);
  });

  it('events are replayed when handlers are registered', async () => {
    const dispatcher = new LegacyDispatcher();
    const eventReplayer = jasmine.createSpy<Replayer>('eventReplayer');
    dispatcher.setEventReplayer(eventReplayer);
    let replayed = waitForEventReplayer(eventReplayer);

    const eventInfo = createTestEventInfo({isReplay: true});
    dispatcher.dispatch(eventInfo);

    await expectAsync(replayed).toBeResolved();
    expectEventReplayerToHaveBeenCalledWith(eventReplayer, [eventInfo], dispatcher);

    replayed = waitForEventReplayer(eventReplayer);

    dispatcher.registerEventInfoHandlers('foo', null, {'bar': () => {}});

    await expectAsync(replayed).toBeResolved();
    expectEventReplayerToHaveBeenCalledWith(eventReplayer, [eventInfo], dispatcher);
  });

  it('dispatches to registered global EventInfo handler', () => {
    const handler = jasmine.createSpy('handler');
    const dispatcher = new LegacyDispatcher();
    dispatcher.registerGlobalHandler('click', handler);

    const eventInfo = createTestEventInfo();
    unsetAction(eventInfo);
    dispatcher.dispatch(eventInfo);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch to non-matching registered global EventInfo handler', () => {
    const handler = jasmine.createSpy('handler');
    const dispatcher = new LegacyDispatcher();
    dispatcher.registerGlobalHandler('click', handler);

    const eventInfo = createTestEventInfo({
      event: new MouseEvent('mousedown', {bubbles: true, cancelable: true}),
      eventType: 'mousedown',
    });
    unsetAction(eventInfo);
    dispatcher.dispatch(eventInfo);

    expect(handler).not.toHaveBeenCalled();
  });

  it('allows propagation for events', () => {
    const container = document.createElement('div');
    window.document.body.appendChild(container);
    const targetElement = document.createElement('div');
    container.appendChild(targetElement);
    const dispatcher = new LegacyDispatcher();

    const targetHandler = jasmine.createSpy('targetHandler');
    targetHandler.and.callFake((event) => {
      const eventInfo = createTestEventInfo({
        eventType: 'click',
        event,
        targetElement,
        container,
        action: {name: 'foo', element: targetElement},
      });
      unsetAction(eventInfo);
      dispatcher.dispatch(eventInfo);
    });
    targetElement.addEventListener('click', targetHandler);
    const parentHandler = jasmine.createSpy('parentHandler');
    container.addEventListener('click', parentHandler);

    targetElement.click();

    expect(targetHandler).toHaveBeenCalled();
    expect(parentHandler).toHaveBeenCalled();
    window.document.body.removeChild(container);
  });

  it('allows propagation for events during global dispatch', () => {
    const container = document.createElement('div');
    window.document.body.appendChild(container);
    const targetElement = document.createElement('div');
    container.appendChild(targetElement);
    const dispatcher = new LegacyDispatcher(undefined, {stopPropagation: true});

    const targetHandler = jasmine.createSpy('targetHandler');
    targetHandler.and.callFake((event) => {
      const eventInfo = createTestEventInfo({
        eventType: 'click',
        event,
        targetElement,
        container,
        action: {name: 'foo', element: targetElement},
      });
      unsetAction(eventInfo);
      dispatcher.dispatch(eventInfo);
    });
    targetElement.addEventListener('click', targetHandler);
    const parentHandler = jasmine.createSpy('parentHandler');
    container.addEventListener('click', parentHandler);

    targetElement.click();

    expect(targetHandler).toHaveBeenCalled();
    expect(parentHandler).toHaveBeenCalled();
    window.document.body.removeChild(container);
  });

  it('stops propagation for events', () => {
    const container = document.createElement('div');
    window.document.body.appendChild(container);
    const targetElement = document.createElement('div');
    container.appendChild(targetElement);
    const dispatcher = new LegacyDispatcher(undefined, {stopPropagation: true});

    const targetHandler = jasmine.createSpy('targetHandler');
    targetHandler.and.callFake((event) => {
      const eventInfo = createTestEventInfo({
        eventType: 'click',
        event,
        targetElement,
        container,
        action: {name: 'foo', element: targetElement},
      });
      dispatcher.dispatch(eventInfo);
    });
    targetElement.addEventListener('click', targetHandler);
    const parentHandler = jasmine.createSpy('parentHandler');
    container.addEventListener('click', parentHandler);

    targetElement.click();

    expect(targetHandler).toHaveBeenCalled();
    expect(parentHandler).not.toHaveBeenCalled();
    window.document.body.removeChild(container);
  });
});
