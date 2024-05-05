/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {global} from './global';

/**
 * Gets a scheduling function that runs the callback after the first of setTimeout and
 * requestAnimationFrame resolves.
 *
 * - `requestAnimationFrame` ensures that change detection runs ahead of a browser repaint.
 * This ensures that the create and update passes of a change detection always happen
 * in the same frame.
 * - When the browser is resource-starved, `rAF` can execute _before_ a `setTimeout` because
 * rendering is a very high priority process. This means that `setTimeout` cannot guarantee
 * same-frame create and update pass, when `setTimeout` is used to schedule the update phase.
 * - While `rAF` gives us the desirable same-frame updates, it has two limitations that
 * prevent it from being used alone. First, it does not run in background tabs, which would
 * prevent Angular from initializing an application when opened in a new tab (for example).
 * Second, repeated calls to requestAnimationFrame will execute at the refresh rate of the
 * hardware (~16ms for a 60Hz display). This would cause significant slowdown of tests that
 * are written with several updates and asserts in the form of "update; await stable; assert;".
 * - Both `setTimeout` and `rAF` are able to "coalesce" several events from a single user
 * interaction into a single change detection. Importantly, this reduces view tree traversals when
 * compared to an alternative timing mechanism like `queueMicrotask`, where change detection would
 * then be interleaves between each event.
 *
 * By running change detection after the first of `setTimeout` and `rAF` to execute, we get the
 * best of both worlds.
 *
 * @returns a function to cancel the scheduled callback
 */
export function scheduleCallbackWithRafRace(callback: Function): () => void {
  let executeCallback = true;
  setTimeout(() => {
    if (!executeCallback) {
      return;
    }
    executeCallback = false;
    callback();
  });
  if (typeof global['requestAnimationFrame'] === 'function') {
    global['requestAnimationFrame'](() => {
      if (!executeCallback) {
        return;
      }
      executeCallback = false;
      callback();
    });
  }

  return () => {
    executeCallback = false;
  };
}

export function scheduleCallbackWithMicrotask(callback: Function): () => void {
  let executeCallback = true;
  queueMicrotask(() => {
    if (executeCallback) {
      callback();
    }
  });

  return () => {
    executeCallback = false;
  };
}
