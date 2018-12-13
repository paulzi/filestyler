(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module unless amdModuleId is set
    define('filestyler', ["jquery"], function (a0) {
      return (factory(a0));
    });
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require("jquery"));
  } else {
    factory(root["jQuery"]);
  }
}(this, function ($) {

'use strict';
var base      = 'filestyler';
var baseItem  = base + '__item';
var baseClass = '.' + base;
var itemClass = '.' + baseItem;
var def       = 'default'; // fix ie8 reserved
var $d        = $(document);
var _supportMultiple = null;

/**
 * @returns {boolean}
 */
function supportMultiple() {
    if (_supportMultiple === null) {
        _supportMultiple = 'multiple' in document.createElement('input');
    }
    return _supportMultiple;
}

/**
 *
 * @param {jQuery} $element
 * @param {String} name
 * @param {Object} [data]
 * @returns {boolean}
 */
function trigger($element, name, data) {
    var event;
    event = $.Event(base + name);
    data && $.extend(event, data);
    $element.trigger(event);
    return event.isDefaultPrevented();
}

/**
 * @param {Event} e
 */
function onChangeHandler(e) {
    var filestyler = $(this).closest(baseClass).data(base);
    if (filestyler) {
        var files, input;
        input = e.target;
        files = input.files;
        if (typeof files === 'undefined') {
            files = [{ name: e.target.value.split('\\').pop() }];
        }
        filestyler.processFiles(files, input);
    }
}

/**
 * @param {Event} e
 */
function onRemoveHandler(e) {
    e.preventDefault();
    var filestyler = $(this).closest(baseClass).data(base);
    var $item = $(this).closest(itemClass);
    filestyler.removeItem($item[0]);
}

/**
 * @param {Event} e
 */
function onClearHandler(e) {
    e.preventDefault();
    var filestyler = $(this).closest(baseClass).data(base);
    filestyler.clear();
}

/**
 * @param {Event} e
 */
function onAddHandler(e) {
    e.preventDefault();
    var filestyler = $(this).closest(baseClass).data(base);
    filestyler.$input.trigger('click');
}

/**
 * @param {Object} config
 */
var FileStyler = function(config) {
    var $element, $file, $input, filestyler, i, mode, plugin, pluginName;
    filestyler = this;
    filestyler.config   = $.extend({}, FileStyler[def], config);
    filestyler.$element = $element = $(config.element);
    filestyler.$file    = $file    = $element.find(baseClass + '__file').slice(1).remove().addBack().first();
    filestyler.$input   = $input   = $file.find(baseClass + '__input');
    filestyler.$list    = $element.find(baseClass + '__list');

    mode = filestyler.config.mode;
    if (mode === 'byOne') {
        $input.removeAttr('multiple').prop('multiple', false);
        filestyler.cloneMode = 'item';
    }
    if (mode === 'add' || (mode === 'default' && !supportMultiple())) {
        filestyler.cloneMode = 'after';
    }

    // init plugins
    filestyler.plugins  = {};
    for (i = 0; i < filestyler.config.plugins.length; i++) {
        pluginName = filestyler.config.plugins[i];
        plugin     = FileStyler.plugins[pluginName];
        if (!plugin) {
            throw new Error('Plugin ' + pluginName + ' of FileStyler not found');
        }
        plugin = plugin.create(filestyler);
        if (plugin) {
            filestyler.plugins[pluginName] = plugin;
        }
    }

    $input.on('change', onChangeHandler);
    $element.on('click', baseClass + '__remove', onRemoveHandler);
    $element.on('click', baseClass + '__clear',  onClearHandler);
    $element.on('click', baseClass + '__add',    onAddHandler);
    $element
        .data(base, filestyler)
        .removeClass(base + '_uninitialized')
        .addClass(base + '_initialized')
        .addClass(base + '_mode_' + filestyler.config.mode);
    trigger($element, 'Init');
};

/**
 * @param {String} method
 * @param {Array} [args]
 */
FileStyler.prototype.callPlugins = function(method, args) {
    var filestyler = this;
    $.each(this.plugins, function(name, plugin) {
        if (plugin[method]) {
            var scope = $.isPlainObject(plugin) ? filestyler : plugin;
            plugin[method].apply(scope, args);
        }
    });
};

/**
 * @param {File[]} files
 * @param {HTMLInputElement} [input]
 */
FileStyler.prototype.processFiles = function(files, input) {
    var i, $item, $last, filestyler, beforeSelector;
    filestyler = this;

    if (trigger(filestyler.$element, 'BeforeProcess', {
            files: files,
            input: input
        })) {
        return;
    }
    beforeSelector = filestyler.config.firstItemInsertBefore;
    if (filestyler.config.mode === 'default' && supportMultiple()) {
        filestyler.$element.find(itemClass).remove();
    }
    filestyler.callPlugins('beforeProcess', [files, input]);

    for (i = 0; i < files.length; i++) {
        $item = filestyler.createItem(files[i], input);
        $last = filestyler.$element.find(itemClass).last();
        if ($last.length) {
            $last.after($item);
        } else {
            if (beforeSelector === true) {
                filestyler.$list.prepend($item);
            }
            if (beforeSelector === false) {
                filestyler.$list.append($item);
            }
            filestyler.$list.find(beforeSelector).before($item);
        }
        trigger($item, 'ItemAdd', {
            item:  $item[0],
            file:  files[i],
            input: input
        });
    }

    if (filestyler.cloneMode) {
        var $clone = filestyler.$input.clone(false).val('');
        filestyler.$input.addClass(base + '__hidden').after($clone);
        if (filestyler.cloneMode === 'item') {
            $item.append(filestyler.$input);
        } else {
            filestyler.$file.before(filestyler.$input);
        }
        filestyler.$input = $clone;
        $clone.on('change', onChangeHandler);
    }

    filestyler.$element.removeClass(base + '_empty');

    filestyler.callPlugins('afterProcess', [files, input]);
    trigger(filestyler.$element, 'Process', {
        files: files,
        input: input
    });
};

/**
 * @param {File} file
 * @param {HTMLInputElement} [input]
 * @returns {jQuery|HTMLElement}
 */
FileStyler.prototype.createItem = function(file, input) {
    var filestyler = this;

    // make data
    var data = {
        filestyler: filestyler,
        file: file,
        fileSizeFormatted: filestyler.config.fileSizeFormatter(file.size, filestyler.config.fileSizeLabels),
        plugins: {}
    };

    // processFile
    filestyler.callPlugins('processFile', [data, file, input]);

    // create item
    var $item = $(filestyler.config.template(data));
    $item.addClass(baseItem);
    if (file.type) {
        var mimeClass = filestyler.config.mimeMap[file.type];
        if (typeof mimeClass === 'undefined') {
            mimeClass = baseItem + '_' + file.type.replace(/[^\w\d_-]/g, '-');
        }
        $item.addClass(mimeClass);
    }

    // processItem
    filestyler.callPlugins('processItem', [$item[0], data, file, input]);
    trigger(filestyler.$element, 'ProcessItem', {
        item:  $item[0],
        data:  data,
        file:  file,
        input: input
    });

    return $item;
};

/**
 * @param {HTMLElement} item
 */
FileStyler.prototype.removeItem = function(item) {
    if (['default', 'add'].indexOf(this.config.mode) !== -1) {
        throw new Error('Mode "' + this.config.mode + '" does not support remove item');
    }
    if (trigger($(item), 'BeforeRemoveItem', {item: item})) {
        return;
    }
    this.callPlugins('removeItem', [item]);
    $(item).remove();
    this.$element.toggleClass(base + '_empty', this.$list.find(itemClass).length === 0);
    trigger(this.$element, 'RemoveItem', {item: item});
};

/**
 */
FileStyler.prototype.clear = function() {
    if (trigger(this.$element, 'BeforeClear')) {
        return;
    }
    this.callPlugins('clear', []);
    this.$element.find(itemClass).remove();
    this.$element.find(baseClass + '__list').children(baseClass + '__input').remove();
    this.$input.val('');
    this.$element.addClass(base + '_empty');
    trigger(this.$element, 'Clear');
};

/**
 */
FileStyler.prototype.destroy = function() {
    var filestyler, $element;
    filestyler = this;
    $element = filestyler.$element;
    filestyler.callPlugins('destroy', []);
    filestyler.$input.off('change', onChangeHandler);
    $element.off('click', baseClass + '__remove', onRemoveHandler);
    $element.off('click', baseClass + '__clear',  onClearHandler);
    $element.off('click', baseClass + '__add',    onAddHandler);
    $element
        .removeData(base)
        .addClass(base + '_uninitialized')
        .removeClass(base + '_initialized')
        .removeClass(base + '_mode_' + filestyler.config.mode);
};

/**
 * @param {Number} size
 * @param {Array} list
 * @returns {String}
 */
FileStyler.fileSizeFormatter = function(size, list) {
    for (var i = 0; i < list.length; i++) {
        if (size < 1024 || i === list.length - 1) {
            return Math.round(size) + ' ' + list[i];
        }
        size = size / 1024;
    }
    return '';
};

/**
 * @param {File|Object} data
 * @returns {Element}
 */
FileStyler.defaultTemplate = function(data) {
    var $result, $info;
    $result = $('<div>');
    $.each(data.plugins, function(i, element) {
        $result.append(element);
    });
    $info = $('<div>').addClass(base + '__info').appendTo($result);
    $('<div>').addClass(base + '__name').append(data.file.name).appendTo($info);
    if (typeof data.file.size !== 'undefined') {
        $('<div>').addClass(base + '__size').append(data.fileSizeFormatted).appendTo($info);
    }
    if (typeof data.file.type !== 'undefined') {
        $('<div>').addClass(base + '__type').append(data.file.type).appendTo($info);
    }
    $('<button type="button">').addClass(base + '__remove').appendTo($result);
    return $result[0];
};

/**
 * @param {String} name
 * @param {Object} plugin
 * @param {boolean} [isDefault]
 */
FileStyler.registerPlugin = function(name, plugin, isDefault) {
    FileStyler.plugins[name] = plugin;
    if (isDefault) {
        FileStyler[def].plugins.push(name);
    }
};

/**
 * @type {Object}
 */
FileStyler.plugins = {};

/**
 * @type {boolean}
 */
FileStyler.autoInit = true;

/**
 * @type {Object}
 */
FileStyler[def] = {
    mode: 'add',
    mimeMap: {},
    plugins: [],
    firstItemInsertBefore: true,
    template: FileStyler.defaultTemplate,
    fileSizeFormatter: FileStyler.fileSizeFormatter,
    fileSizeLabels: ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
};

window.FileStyler = FileStyler;
var SortHelperPlugin = {
    /**
     */
    create: function() {
        return SortHelperPlugin;
    },

    /**
     * @param {FileStyler} filestyler
     * @returns {String}
     */
    getName: function (filestyler) {
        var helper = filestyler.config.sortHelper;
        if (helper === true) {
            return filestyler.$input.attr('name');
        }
        if (typeof helper === 'string') {
            return helper;
        }
        if (typeof helper === 'function') {
            return helper(filestyler);
        }
        return null;
    },

    /**
     * @param {Object} data
     */
    processFile: function(data) {
        var filestyler = this;
        if (filestyler.config.sortHelper) {
            var index = filestyler.sortIndex;
            if (typeof index === 'undefined') {
                var max = -1;
                filestyler.$list.find(baseClass + '__sort-helper').each(function() {
                    var v = parseInt(this.value, 10) || 0;
                    max = v > max ? v : max;
                });
                index = max;
            }
            filestyler.sortIndex = index + 1;
            data.sortName  = SortHelperPlugin.getName(filestyler);
            data.sortValue = index + 1;
            data.plugins.sortHelper = SortHelperPlugin.template(data);
        }
    },

    /**
     * @param {Object} data
     * @returns {String}
     */
    template: function(data) {
        return '<input type="hidden" class="' + base + '__sort-helper" name="' + data.sortName + '" value="' + data.sortValue + '"/>';
    }
};

FileStyler.registerPlugin('sortHelper', SortHelperPlugin, true);
FileStyler[def].sortHelper = false;
var ImagePlugin = {

    /**
     */
    create: function() {
        return ImagePlugin;
    },

    /**
     * @param {Object} data
     * @param {File} file
     */
    processFile: function(data, file) {
        var filestyler = this;
        data.isImage = !!(file.type && $.inArray(file.type, filestyler.config.supportedImages) !== -1);
        if (data.isImage) {
            var urlCreator;
            urlCreator = window.URL || window.webkitURL;
            if (urlCreator) {
                data.image = urlCreator.createObjectURL(file);
            }
            data.plugins.image = ImagePlugin.template();
        }
    },

    /**
     * @param {HTMLElement} item
     * @param {Object} data
     * @param {File} file
     */
    processItem: function(item, data, file) {
        var process = function(url) {
            var $item = $(item);
            if (!trigger($item, 'ImageLoad', {
                item: item,
                url:  url
            })) {
                $item.find(baseClass + '__image-bg').css('background-image', 'url(' + url + ')');
                $item.find(baseClass + '__image').attr('src', url);
            }
        };

        $(item).toggleClass(baseItem + '_is-image', data.isImage).toggleClass(baseItem + '_is-no-image', !data.isImage);

        if (data.image) {
            process(data.image);
        } else if (data.isImage && window.FileReader) {
            var fileReader = new FileReader();
            fileReader.onloadend = function() {
                process(fileReader.result);
            };
            fileReader.readAsDataURL(file);
        }
    },

    /**
     * @returns {String}
     */
    template: function() {
        return '<div class="' + base + '__figure ' + base + '__image-bg"><img class="' + base + '__image"/></div>';
    }
};

FileStyler.registerPlugin('image', ImagePlugin, true);
FileStyler[def].supportedImages = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
function dragInputMove(filestyler, $target) {
    if (filestyler.config.moveInputOnDrag) {
        $target.data(base + 'Input', [filestyler.$input.parent(), filestyler.$input.next()]);
        filestyler.$input.addClass(base + '__drop-input');
        $target.append(filestyler.$input);
    }
}

/**
 * @param {FileStyler} filestyler
 * @param {jQuery} $target
 */
function dragInputRestore(filestyler, $target) {
    if (filestyler.config.moveInputOnDrag) {
        var to = $target.data(base + 'Input');
        if (to[1].length) {
            to[1].before(filestyler.$input);
        } else {
            to[0].append(filestyler.$input);
        }
        filestyler.$input.removeClass(base + '__drop-input');
    }
}

var DropPlugin = {

    /**
     * @param {FileStyler} filestyler
     * @returns {Object}
     */
    create: function(filestyler) {
        var $drop, supportMode;
        $drop = filestyler.$element.find(baseClass + '__drop');
        supportMode = $.inArray(filestyler.config.mode, filestyler.config.allowDropNoInput) !== -1;

        filestyler.drop = 0;

        var documentDragEnter = function(e) {
            if (e.originalEvent.dataTransfer.files) {
                filestyler.drop = filestyler.drop ? 2 : 1;
                if (filestyler.drop > 0) {
                    $drop.addClass(base + '__drop_hint');
                }
            }
        };

        var documentDragLeave = function(e) {
            if (e.originalEvent.dataTransfer.files) {
                filestyler.drop = filestyler.drop === 2 ? 1 : 0;
                if (filestyler.drop <= 0) {
                    $drop.removeClass(base + '__drop_hint');
                }
            }
        };

        var documentDrop = function() {
            filestyler.drop = 0;
            $drop.removeClass(base + '__drop_hint');
        };

        var dragEnter = function(e) {
            if (e.originalEvent.dataTransfer.files) {
                var $target = $(this);
                if (!$(e.target).hasClass(base + '__input')) { // need for chrome
                    e.preventDefault(); // need for ie
                }

                var state = $target.data(base);
                var prev = $target.data(base + 'Prev');
                if (!state) {
                    $target.addClass(base + '__drop_in');
                    dragInputMove(filestyler, $target);

                }
                $target.data(base, state === 1 && prev !== e.target ? 2 : 1);
                $target.data(base + 'Prev', e.target);
            }
        };

        var dragLeave = function(e) {
            if (e.originalEvent.dataTransfer.files) {
                e.preventDefault(); // need for ie
                var $target = $(this);
                var state = $target.data(base) === 2 ? 1 : 0;
                $target.data(base, state);
                $target.data(base + 'Prev', null);
                if (!state) {
                    $target.removeClass(base + '__drop_in');
                    dragInputRestore(filestyler, $target);
                }
            }
        };

        var dragOver = function(e) {
            e.preventDefault();
        };

        var drop = function(e) {
            if (e.originalEvent.dataTransfer.files) {
                var $target = $(this);
                $target
                    .removeClass(base + '__drop_hint')
                    .removeClass(base + '__drop_in')
                    .data(base, 0);
                filestyler.drop = 0;
                dragInputRestore(filestyler, $target);
                if (supportMode) {
                    e.preventDefault();
                    filestyler.processFiles(e.originalEvent.dataTransfer.files);
                }
                if (!supportMode && e.target !== filestyler.$input[0]) {
                    e.preventDefault();
                    throw new Error('Mode "' + filestyler.config.mode + '" does not support drop files not on input element (hint: use moveInputOnDrag = true)');
                }
            }
        };

        var inputDragOver = function(e) {
            e.preventDefault();
        };

        filestyler.dropHandlers = {
            documentDragEnter: documentDragEnter,
            documentDragLeave: documentDragLeave,
            documentDrop:      documentDrop,
            dragEnter:         dragEnter,
            dragLeave:         dragLeave,
            dragOver:          dragOver,
            drop:              drop,
            inputDragOver:     inputDragOver
        };

        $d.on('dragenter',    documentDragEnter);
        $d.on('dragleave',    documentDragLeave);
        $d.on('drop',         documentDrop);
        $drop.on('dragenter', dragEnter);
        $drop.on('dragleave', dragLeave);
        $drop.on('dragover',  dragOver);
        $drop.on('drop',      drop);
        filestyler.$input.on('dragover', inputDragOver);

        return DropPlugin;
    },

    /**
     */
    destroy: function() {
        var filestyler, dropHandlers, $drop;
        filestyler = this;
        dropHandlers = filestyler.dropHandlers;
        $drop = filestyler.$element.find(baseClass + '__drop');
        $d.off('dragenter',    dropHandlers.documentDragEnter);
        $d.off('dragleave',    dropHandlers.documentDragLeave);
        $d.off('drop',         dropHandlers.documentDrop);
        $drop.off('dragenter', dropHandlers.dragEnter);
        $drop.off('dragleave', dropHandlers.dragLeave);
        $drop.off('dragover',  dropHandlers.dragOver);
        $drop.off('drop',      dropHandlers.drop);
        filestyler.$input.on('dragover', dropHandlers.inputDragOver);
    }
};

FileStyler.registerPlugin('drop', DropPlugin, true);
FileStyler[def].allowDropNoInput = ['base64', 'ajax'];
FileStyler[def].moveInputOnDrag = true;

$.fn.filestyler = function(config) {
    this.each(function () {
        new FileStyler($.extend({element: this}, config || {}, $(this).data(base) || {}));
    });
};

$(function () {
    if (FileStyler.autoInit) {
        $(baseClass).filestyler();
    }
});

}));
