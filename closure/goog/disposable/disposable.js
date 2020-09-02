// Copyright 2005 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Implements the disposable interface. The dispose method is used
 * to clean up references and resources.
 */


goog.provide('goog.Disposable');
goog.provide('goog.dispose');
goog.provide('goog.disposeAll');

goog.require('goog.disposable.IDisposable');

/**
 * @define {number} The monitoring mode of the goog.Disposable
 *     instances. Default is OFF. Switching on the monitoring is only
 *     recommended for debugging because it has a significant impact on
 *     performance and memory usage. If switched off, the monitoring code
 *     compiles down to 0 bytes.
 */
goog.Disposable.MONITORING_MODE =
    goog.define('goog.Disposable.MONITORING_MODE', 0);


/**
 * @define {boolean} Whether to attach creation stack to each created disposable
 *     instance; This is only relevant for when MonitoringMode != OFF.
 */
goog.Disposable.INCLUDE_STACK_ON_CREATION =
    goog.define('goog.Disposable.INCLUDE_STACK_ON_CREATION', true);

/**
 * Class that provides the basic implementation for disposable objects. If your
 * class holds one or more references to COM objects, DOM nodes, or other
 * disposable objects, it should extend this class or implement the disposable
 * interface (defined in goog.disposable.IDisposable).
 * @constructor
 * @implements {goog.disposable.IDisposable}
 */
goog.Disposable = function() {
  /**
   * If monitoring the goog.Disposable instances is enabled, stores the creation
   * stack trace of the Disposable instance.
   * @type {string|undefined}
   */
  this.creationStack;

  if (goog.Disposable.MONITORING_MODE != goog.Disposable.MonitoringMode.OFF) {
    if (goog.Disposable.INCLUDE_STACK_ON_CREATION) {
      this.creationStack = new Error().stack;
    }
    goog.Disposable.instances_[goog.getUid(this)] = this;
  }
  // Support sealing
  // LUCID modification: We don't use Object.seal(), or the goog.base stuff that does it. We save about 4% of our total
  // JS heap size on large documents by not setting these properties aggressively.
  // this.disposed_ = this.disposed_;
  // this.onDisposeCallbacks_ = this.onDisposeCallbacks_;
  // this.registeredDisposables_ = this.registeredDisposables_;
};


/**
 * @enum {number} Different monitoring modes for Disposable.
 */
goog.Disposable.MonitoringMode = {
  /**
   * No monitoring.
   */
  OFF: 0,
  /**
   * Creating and disposing the goog.Disposable instances is monitored. All
   * disposable objects need to call the `goog.Disposable` base
   * constructor. The PERMANENT mode must be switched on before creating any
   * goog.Disposable instances.
   */
  PERMANENT: 1,
  /**
   * INTERACTIVE mode can be switched on and off on the fly without producing
   * errors. It also doesn't warn if the disposable objects don't call the
   * `goog.Disposable` base constructor.
   */
  INTERACTIVE: 2
};

/**
 * Maps the unique ID of every undisposed `goog.Disposable` object to
 * the object itself.
 * @type {!Object<number, !goog.Disposable>}
 * @private
 */
goog.Disposable.instances_ = {};


/**
 * @return {!Array<!goog.Disposable>} All `goog.Disposable` objects that
 *     haven't been disposed of.
 */
goog.Disposable.getUndisposedObjects = function() {
  var ret = [];
  for (var id in goog.Disposable.instances_) {
    if (goog.Disposable.instances_.hasOwnProperty(id)) {
      ret.push(goog.Disposable.instances_[Number(id)]);
    }
  }
  return ret;
};


/**
 * Clears the registry of undisposed objects but doesn't dispose of them.
 */
goog.Disposable.clearUndisposedObjects = function() {
  goog.Disposable.instances_ = {};
};


/**
 * Whether the object has been disposed of.
 * @type {boolean}
 * @private
 */
goog.Disposable.prototype.disposed_ = false;


/**
 * Callbacks to invoke when this object is disposed.
 * @type {Array<!Function>}
 * @private
 */
goog.Disposable.prototype.onDisposeCallbacks_;

/**
 * Other Disposables to dispose when this object is disposed.
 * @type {Array<goog.disposable.IDisposable>}
 * @private
 */
goog.Disposable.prototype.registeredDisposables_;

/**
 * @return {boolean} Whether the object has been disposed of.
 * @override
 */
goog.Disposable.prototype.isDisposed = function() {
  return this.disposed_;
};


/**
 * @return {boolean} Whether the object has been disposed of.
 * @deprecated Use {@link #isDisposed} instead.
 */
goog.Disposable.prototype.getDisposed = goog.Disposable.prototype.isDisposed;

/**
 * Added to disposed objects. This allows you to do a heap dump and search for
 * all disposed objects (by finding their DisposedMarker instances) and track
 * down the retaining paths, to clean up memory leaks.
 * @constructor
 */
goog.DisposedMarker = function() {};

/**
 * Disposes of the object. If the object hasn't already been disposed of, calls
 * {@link #disposeInternal}. Classes that extend `goog.Disposable` should
 * override {@link #disposeInternal} in order to delete references to COM
 * objects, DOM nodes, and other disposable objects. Reentrant.
 *
 * @return {void} Nothing.
 * @override
 */
goog.Disposable.prototype.dispose = function() {
  if (!this.disposed_) {
    // Set disposed_ to true first, in case during the chain of disposal this
    // gets disposed recursively.
    this.disposed_ = true;
    this.disposeInternal();
    if (goog.Disposable.MONITORING_MODE != goog.Disposable.MonitoringMode.OFF) {
      var uid = goog.getUid(this);
      if (goog.Disposable.MONITORING_MODE ==
              goog.Disposable.MonitoringMode.PERMANENT &&
          !goog.Disposable.instances_.hasOwnProperty(uid)) {
        throw new Error(
            this + ' did not call the goog.Disposable base ' +
            'constructor or was disposed of after a clearUndisposedObjects ' +
            'call');
      }
      if (goog.Disposable.MONITORING_MODE !=
              goog.Disposable.MonitoringMode.OFF &&
          this.onDisposeCallbacks_ && this.onDisposeCallbacks_.length > 0) {
        throw new Error(
            this + ' did not empty its onDisposeCallbacks queue. This ' +
            'probably means it overrode dispose() or disposeInternal() ' +
            'without calling the superclass\' method.');
      }
      delete goog.Disposable.instances_[uid];
    }

    // In debug mode, disallow all access to disposed object members.
    // Never allow this to happen in compiled mode, even for unit tests,
    // because the compiler can sometimes reorder statements in a way that
    // causes this to fail.
    if (goog.DEBUG && !COMPILED) {
      // The only thing a disposed object can do is return true from
      // isDisposed() or a harmless `dispose()` call.
      let whitelist = {
        isDisposed: 1,
        disposed_: 1,
        dispose: 1,
      };

      // Keep a reference to the old values, so we can determine what object is
      // throwing these errors more easily.
      let oldValues = {};
      for (let key in this) {
        if (whitelist[key]) {
          continue;
        }

        oldValues[key] = this[key];
        Object.defineProperty(this, key, {
          get: function() {
            throw new Error(
                'Cannot access member ' + key + ' of disposed object');
          },
          set: function(value) {
            if (!goog.isFunction(value)) {
                throw new Error('Cannot set member ' + key + ' of disposed object');
            }
          }
        });
      }
      this.__oldValues__ = oldValues;
      this.__disposedMarker__ = new goog.DisposedMarker();
    }
  }
};

/**
 * Associates a disposable object with this object so that they will be disposed
 * together.
 * @param {goog.disposable.IDisposable} disposable that will be disposed when
 *     this object is disposed.
 */
goog.Disposable.prototype.registerDisposable = function(disposable) {
  if (this.disposed_) {
    disposable.dispose();
    return;
  }
  if (!this.registeredDisposables_) {
    this.registeredDisposables_ = [];
  }

  this.registeredDisposables_.push(disposable);
};

/**
 * Disassociates a disposable object with this object so that they won't be
 * disposed together.
 * @param {goog.disposable.IDisposable} disposable that won't be disposed when
 *     this object is disposed.
 */
goog.Disposable.prototype.unregisterDisposable = function(disposable) {
  if (this.disposed_ || !this.registeredDisposables_) {
    return;
  }

  goog.array.remove(this.registeredDisposables_, disposable);
};

/**
 * Invokes a callback function when this object is disposed. Callbacks are
 * invoked in the order in which they were added. If a callback is added to
 * an already disposed Disposable, it will be called immediately.
 * @param {function(this:T):?} callback The callback function.
 * @param {T=} opt_scope An optional scope to call the callback in.
 * @return {function(this:T):?} A callback you can pass to
 *     removeOnDisposeCallback to undo this addOnDisposeCallback.
 * @template T
 */
goog.Disposable.prototype.addOnDisposeCallback = function(callback, opt_scope) {
  if (this.disposed_) {
    opt_scope !== undefined ? callback.call(opt_scope) : callback();
    return callback;
  }
  if (!this.onDisposeCallbacks_) {
    this.onDisposeCallbacks_ = [];
  }

  this.onDisposeCallbacks_.push(
      opt_scope !== undefined ? goog.bind(callback, opt_scope) : callback);
  return callback;
};

/**
 * Remove a callback added with addOnDisposeCallback.
 * @param {function(this:T):?} callback The callback function.
 * @template T
 */
goog.Disposable.prototype.removeOnDisposeCallback = function(callback) {
  if (this.disposed_ || !this.onDisposeCallbacks_) {
    return;
  }

  goog.array.remove(this.onDisposeCallbacks_, callback);
};

/**
 * Deletes or nulls out any references to COM objects, DOM nodes, or other
 * disposable objects. Classes that extend `goog.Disposable` should
 * override this method.
 * Not reentrant. To avoid calling it twice, it must only be called from the
 * subclass' `disposeInternal` method. Everywhere else the public
 * `dispose` method must be used.
 * For example:
 * <pre>
 *   mypackage.MyClass = function() {
 *     mypackage.MyClass.base(this, 'constructor');
 *     // Constructor logic specific to MyClass.
 *     ...
 *   };
 *   goog.inherits(mypackage.MyClass, goog.Disposable);
 *
 *   mypackage.MyClass.prototype.disposeInternal = function() {
 *     // Dispose logic specific to MyClass.
 *     ...
 *     // Call superclass's disposeInternal at the end of the subclass's, like
 *     // in C++, to avoid hard-to-catch issues.
 *     mypackage.MyClass.base(this, 'disposeInternal');
 *   };
 * </pre>
 * @protected
 */
goog.Disposable.prototype.disposeInternal = function() {
  if (this.onDisposeCallbacks_) {
    while (this.onDisposeCallbacks_.length) {
      this.onDisposeCallbacks_.shift()();
    }
  }
  if (this.registeredDisposables_) {
    while (this.registeredDisposables_.length) {
      this.registeredDisposables_.shift().dispose();
    }
  }
};


/**
 * Returns True if we can verify the object is disposed.
 * Calls `isDisposed` on the argument if it supports it.  If obj
 * is not an object with an isDisposed() method, return false.
 * @param {*} obj The object to investigate.
 * @return {boolean} True if we can verify the object is disposed.
 */
goog.Disposable.isDisposed = function(obj) {
  if (obj && typeof obj.isDisposed == 'function') {
    return obj.isDisposed();
  }
  return false;
};


/**
 * Calls `dispose` on the argument if it supports it. If obj is not an
 *     object with a dispose() method, this is a no-op.
 * @param {*} obj The object to dispose of.
 */
goog.dispose = function(obj) {
  if (obj && typeof obj.dispose == 'function') {
    obj.dispose();
  }
};


/**
 * Calls `dispose` on each member of the list that supports it. (If the
 * member is an ArrayLike, then `goog.disposeAll()` will be called
 * recursively on each of its members.) If the member is not an object with a
 * `dispose()` method, then it is ignored.
 * @param {...*} var_args The list.
 */
goog.disposeAll = function(var_args) {
  for (var i = 0, len = arguments.length; i < len; ++i) {
    var disposable = arguments[i];
    if (goog.isArrayLike(disposable)) {
      goog.disposeAll.apply(null, disposable);
    } else {
      goog.dispose(disposable);
    }
  }
};
