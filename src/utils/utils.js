export class Utils {

  static isArray(input) {
    return Object.prototype.toString.call(input) === "[object Array]";
  }

  static isObject(input) {
    return Object.prototype.toString.call(input) === "[object Object]";
  }

  static isNumber(input) {
    return Object.prototype.toString.call(input) === "[object Number]";
  }

  static isString(input) {
    return Object.prototype.toString.call(input) === "[object String]";
  }

  static throttle(delay, action) {
    let last = 0;
    return function () {
      const curr = +new Date();
      if (curr - last > delay) {
        action.apply(this, arguments);
        last = curr
      }
    }
  }

  static getFragIdByDbId(viewer, dbId) {

    return new Promise((resolve, reject) => {
      const it = viewer.model.getData().instanceTree;

      it.enumNodeFragments(dbId, function (fragId) {
        if (fragId || fragId >= 0) {
          resolve(fragId);
        } else {
          reject()
        }
      }, false);
    });
  }

  static clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  static subscribeToAllEvents(viewer) {
    for (let key in Autodesk.Viewing) {
      if (key.endsWith("_EVENT")) {
        ((eventName) => {
          viewer.addEventListener(
            Autodesk.Viewing[eventName],
            Autodesk.Viewing[eventName],
            (event) => {
              console.log(eventName, event);
            }
          );
        })(key);
      }
    }
  }

  static buildModelTree(model) {

    //builds model tree recursively
    function _buildModelTreeRec(node) {
      it.enumNodeChildren(node.dbId, function (childId) {
        node.children = node.children || [];

        const childNode = {
          dbId: childId,
          name: it.getNodeName(childId)
        };

        node.children.push(childNode);

        _buildModelTreeRec(childNode);
      });

    }

    //get model instance tree and root component
    const it = model.getData().instanceTree;

    const rootId = it.getRootId();

    const rootNode = {
      dbId: rootId,
      name: it.getNodeName(rootId)
    };

    _buildModelTreeRec(rootNode);

    return rootNode;
  }
}
