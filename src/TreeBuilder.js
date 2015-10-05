/**
 * Transform the current props into a tree structure representing the complex state
 * @param props
 * @param state
 * @return {TreeNode}
 */
function createNewRootNode(props, state) {
    var rootNode = buildTreeSkeleton(props, state);
    recursivelyAggregateNodes(rootNode, state);

    rootNode.sortRecursivelyBySortIndex();
    rootNode.foldSubTree();

    return rootNode;
}
/*
 this.sectorTitle = sectorTitle;
 this.parent = parent;
 this.subtotalByColumnDef = {};
 this.rowData = null;
 this.display = true;
 this.children = [];
 this.ultimateChildren = [];
 this.collapsed = true
 */
function createNewNodeFromStrucutre(treeData, titleKey, parent){
    var node = new TreeNode( parent ? treeData[titleKey] : "Grand Total", parent);
    _.each(treeData.children, function(child){
        if( child.children.length > 0 )
            node.children.push(createNewNodeFromStrucutre(child, titleKey, node));
        else
            node.ultimateChildren.push(createNewNodeFromStrucutre(child, titleKey, node));
    });
    if( node.ultimateChildren.length == 0 )
        node.isDetail = true;
    else
        setupChildrenMap(node);
    _.each(treeData, function(value, key){
        if( !_.isObject(value) ) {
            if( !node.rowData )
                node.rowData = {};
            if( node.ultimateChildren.length == 0 )
                node[key] = value;
            else
                node.rowData[key] = value;
        }
    });

    return node;
}

function setupChildrenMap(node){
    _.each(node.children, function(child){
        node.ultimateChildren = node.ultimateChildren.concat(child.ultimateChildren);
        node._childrenSectorNameMap[child.sectorTitle] = child;
    });
}

/**
 * adding new subtotalBy, only create the deepest level subtree
 * @param lrootNode
 * @param newSubtotal
 * @param state
 */
function buildSubtree(lrootNode, newSubtotal, state) {
    if (lrootNode.children.length == 0 || (lrootNode.children.children && lrootNode.children.children.length == 0)) {
        //find the leaf node
        for (var j = 0; j < lrootNode.ultimateChildren.length; j++) {
            //build subtree
            populateChildNodesForRow(lrootNode, lrootNode.ultimateChildren[j], newSubtotal);
        }
        for (var key in lrootNode._childrenSectorNameMap) {
            //generate subtree's aggregation info
            var node = lrootNode._childrenSectorNameMap[key];
            node.rowData = aggregateSector(node.ultimateChildren, state.columnDefs, newSubtotal);
        }
    } else {
        for (var i = 0; i < lrootNode.children.length; i++) {
            buildSubtree(lrootNode.children[i], newSubtotal, state);
        }
    }
}

/**
 * add a new subtotalBy, build subtrees in leaf nodes
 * @param state
 * @returns {*}
 */
function buildSubtreeForNewSubtotal(state) {
    var newSubtotal = [state.subtotalBy[state.subtotalBy.length - 1]];
    buildSubtree(state.rootNode, newSubtotal, state);
    state.rootNode.sortRecursivelyBySortIndex();
    state.rootNode.foldSubTree();

    return state.rootNode;
}

/**
 * destory all subtree in root
 * @param lroot
 */
function destorySubtreesRecursively(lroot) {
    if (lroot.children.length == 0) {
        return;
    }

    for (var i = 0; i < lroot.children.length; i++) {
        destorySubtreesRecursively(lroot.children[i]);
        lroot.children[i] = null;
    }
    lroot.children = [];
    lroot._childrenSectorNameMap = {};
}

/**
 * destory root's subtrees to clear subtotals
 * @param state
 */
function destorySubtrees(state) {
    destorySubtreesRecursively(state.rootNode);
}

/**
 * Creates the TreeNode structure backed by props.data and grouped by columns specified in subtotalBy
 * @param props
 * @param state
 * @return {TreeNode} the root node
 */
function buildTreeSkeleton(props, state) {
    var rootNode = new TreeNode("Grand Total", null), rawData = props.data, i;
    if (props.disableGrandTotal)
        rootNode.display = false;
    for (i = 0; i < rawData.length; i++) {
        rootNode.appendUltimateChild(rawData[i]);
        populateChildNodesForRow(rootNode, rawData[i], state.subtotalBy);
    }

    return rootNode
}

/**
 * Populate an existing skeleton (represented by the root node) with summary level data
 * @param node
 * @param state
 */
// can postpone generate lower level aggregation information to accelerate initial render
function recursivelyAggregateNodes(node, state) {
    // aggregate the current node
    node.rowData = aggregateSector(node.ultimateChildren, state.columnDefs, state.subtotalBy);

    // for each child - aggregate those as well
    if (node.children.length > 0) {
        for (var i = 0; i < node.children.length; i++)
            recursivelyAggregateNodes(node.children[i], state);
    }
}

/*
 * ----------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------
 */

/**
 * Append the proper children TreeNode(s) to the `currentNode`
 * Children nodes are generated by running `subtotalBy` through
 * a sectoring process. The unique set of sector names resulting from this sectoring process
 * determines the children nodes for the `currentNode`
 *
 * @param currentNode {TreeNode}
 * @param ultimateChild {object}
 * @param subtotalBy
 */
function populateChildNodesForRow(currentNode, ultimateChild, subtotalBy) {
    var i;
    if (subtotalBy == null || subtotalBy.length == 0)
        return;
    for (i = 0; i < subtotalBy.length; i++) {
        const sectoringResult = classifyRow(ultimateChild, subtotalBy[i]);
        currentNode.appendRowToChildren({
            childSectorName: sectoringResult.sectorName,
            childRow: ultimateChild,
            sortIndex: sectoringResult.sortIndex,
            subtotalByColumnDef: subtotalBy[i]
        });
    }
}
