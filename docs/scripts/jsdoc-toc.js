(function($) {
    // TODO: make the node ID configurable
    var treeNode = $('#jsdoc-toc-nav');

    // initialize the tree
    treeNode.tree({
        autoEscape: false,
        closedIcon: '&#x21e2;',
        data: [{"label":"<a href=\"module-thorn.html\">thorn</a>","id":"module:thorn","children":[{"label":"<a href=\"module-thorn-Agent.html\">Agent</a>","id":"module:thorn~Agent","children":[]},{"label":"<a href=\"module-thorn-Fixtures.html\">Fixtures</a>","id":"module:thorn~Fixtures","children":[]},{"label":"<a href=\"module-thorn-UserAgent.html\">UserAgent</a>","id":"module:thorn~UserAgent","children":[]}]}],
        openedIcon: ' &#x21e3;',
        saveState: true,
        useContextMenu: false
    });

    // add event handlers
    // TODO
})(jQuery);
