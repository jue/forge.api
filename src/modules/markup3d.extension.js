import { MultiModelExtensionBase } from "../extension/multi-model-extension-base";
import { Markup3d } from './markup3d'
import { EventTool } from "../utils/event-tool";
import { Utils } from "../utils/utils";
import Snap from 'imports-loader?this=>window,fix=>module.exports=0!snapsvg/dist/snap.svg.js';

export class Markup3dExtension extends MultiModelExtensionBase {
	constructor(viewer, options) {
		super(viewer, options);
	}

	static get ExtensionId() {
		return 'Viewing.Extension.Markup3D';
	}

	load() {
		// 将背景颜色改成红色
		this.viewer.setBackgroundColor(255, 0, 0, 255, 255, 255);
		return true;
	}

	unload() {
		// 将背景颜色改回来 Viewer3D 自带的
		this.viewer.setBackgroundColor(160, 176, 184, 190, 207, 216);
		return true;
	}

	/**
 *
 * @param point {x,y,z} | THEE.Vector3  坐标
 * @param dbId
 * @param optionsElement? {innerHTML:string,className:string,others:Object<any>}
 */
	add(point, dbId, optionsElement, type = 1) {
		Utils.getFragIdByDbId(this.viewer, dbId).then(fragId => {
			console.log(fragId)
		});
	}
}

Autodesk.Viewing.theExtensionManager.registerExtension(Markup3dExtension.ExtensionId, Markup3dExtension);