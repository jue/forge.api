import { MultiModelExtensionBase } from "../extension/multi-model-extension-base";
import { Markup3d } from './markup3d'
import { EventTool } from "../utils/event-tool";
import { Utils } from "../utils/utils";
import Snap from 'imports-loader?this=>window,fix=>module.exports=0!snapsvg/dist/snap.svg.js';

export class Markup3dExtension extends MultiModelExtensionBase {
	constructor(viewer, options = {}) {
		super(viewer, options);

		this.onCameraChanged = this.onCameraChanged.bind(this)

		this.viewer = viewer

		this.dbIds = this.getAllDbIds()

		this.viewer.addEventListener(
			Autodesk.Viewing.CAMERA_CHANGE_EVENT,
			this.onCameraChanged)

		// Vertex Shader code
		const vertexShader = options.vertexShader || `
      attribute float pointSize;
      void main() {
        vec4 vPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * vPosition;
        gl_PointSize = pointSize;
      }
    `

		// Fragment Shader code
		const fragmentShader = options.fragmentShader || `
      uniform sampler2D texture;
      void main() {
        vec4 tex = texture2D(texture, gl_PointCoord);
        if (tex.a < 0.5) discard;
        gl_FragColor = vec4(tex.r, tex.g, tex.b, tex.a);
      }
    `

		const texture = options.texture || "https://i.loli.net/2019/12/20/rvYUJ8kc1yzSq3N.png"

		// Shader material parameters
		const shaderParams = options.shaderParams || {
			side: THREE.DoubleSide,
			depthWrite: false,
			depthTest: false,
			fragmentShader,
			vertexShader,
			opacity: 0.5,
			attributes: {
				pointSize: {
					type: 'f',
					value: []
				}
			},
			uniforms: {
				texture: {
					value: THREE.ImageUtils.loadTexture(texture),
					type: 't'
				}
			}
		}

		// Initialize geometry vertices
		// and shader attribute colors
		this.geometry = new THREE.Geometry()

		const maxPoints = options.maxPoints || 10000

		for (var i = 0; i < maxPoints; ++i) {

			this.geometry.vertices.push(new THREE.Vector3)
		}

		// creates shader material
		const shaderMaterial =
			new THREE.ShaderMaterial(
				shaderParams)

		// creates THREE.PointCloud
		this.pointCloud = new THREE.PointCloud(
			this.geometry, shaderMaterial)

		// adds to the viewer scene
		this.viewer.impl.sceneAfter.add(this.pointCloud)

		this.options = options

		this.markups = []
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

	/////////////////////////////////////////////////////////
	// Camera Changed event handler
	//
	/////////////////////////////////////////////////////////
	onCameraChanged() {

		this.markups.forEach((markup) => {

			if (markup.visible && markup.occlusion) {

				const occluded = this.checkOcclusion(markup)

				this.setMarkupSize(markup.id,
					occluded ? 0.0 : markup.size,
					true)
			}
		})
	}

	/////////////////////////////////////////////////////////
	// Get list of all dbIds in the model
	//
	/////////////////////////////////////////////////////////
	getAllDbIds() {

		const { instanceTree } = this.viewer.model.getData()

		const { dbIdToIndex } = instanceTree.nodeAccess

		return Object.keys(dbIdToIndex).map((dbId) => {

			return parseInt(dbId)
		})
	}

	/////////////////////////////////////////////////////////
	// Returns markup from markupId
	//
	/////////////////////////////////////////////////////////
	getMarkupById(markupId) {

		const res = this.markups.filter((markup) => {

			return markup.id === markupId
		})

		return res.length ? res[0] : null
	}

	/////////////////////////////////////////////////////////
	// Set markup size
	//
	/////////////////////////////////////////////////////////
	setMarkupSize(markupId, size, override) {

		const { pointSize } = this.pointCloud.material.attributes

		const markup = this.getMarkupById(markupId)

		if (override) {

			pointSize.value[markup.index] = size

		} else if (markup.visible) {

			if (markup.occlusion) {

				if (!this.checkOcclusion(markup)) {

					pointSize.value[markup.index] = size
				}

			} else {

				pointSize.value[markup.index] = size
			}
		}

		markup.size = !override ? size : markup.size

		pointSize.needsUpdate = true

		this.viewer.impl.invalidate(true)
	}

	/////////////////////////////////////////////////////////
	// Adds new markup
	//
	/////////////////////////////////////////////////////////
	addMarkup(markupInfo) {

		const size = markupInfo.size ||
			this.options.markupSize ||
			25.0

		const markup = Object.assign({}, {
			id: this.guid('xxx-xxx-xxx'),
			occlusion: true,
			visible: true,
			size
		}, markupInfo, {
			index: this.markups.length
		})

		const vertex = this.geometry.vertices[markup.index]

		vertex.x = markup.point.x
		vertex.y = markup.point.y
		vertex.z = markup.point.z

		this.geometry.verticesNeedUpdate = true

		this.markups.push(markup)

		this.setMarkupSize(
			markup.id, markup.size)

		this.emit('markup.created', markup)

		return markup
	}

	/////////////////////////////////////////////////////////
	// Removes markup
	//
	/////////////////////////////////////////////////////////
	removeMarkup(markupId) {

		const { pointSize } = this.pointCloud.material.attributes

		this.markups = this.markups.filter((markup) => {

			return (markup.id !== markupId)
		})

		this.markups.forEach((markup, idx) => {

			const vertex = this.geometry.vertices[idx]

			pointSize.value[idx] = markup.size

			vertex.x = markup.point.x
			vertex.y = markup.point.y
			vertex.z = markup.point.z

			markup.index = idx
		})

		for (let idx = this.markups.length;
			idx < this.geometry.vertices.length; ++idx) {

			pointSize.value[idx] = 0.0
		}

		this.geometry.verticesNeedUpdate = true

		pointSize.needsUpdate = true

		this.viewer.impl.invalidate(true)

		this.emit('markup.deleted',
			markupId)
	}

	/////////////////////////////////////////////////////////
	// Clear all markups
	//
	/////////////////////////////////////////////////////////
	clearMarkups() {

		const { pointSize } = this.pointCloud.material.attributes

		const { length } = this.geometry.vertices

		for (let idx = 0; idx < length; ++idx) {

			pointSize.value[idx] = 0.0
		}

		pointSize.needsUpdate = true

		this.viewer.impl.invalidate(true)

		this.markups = []
	}

	/////////////////////////////////////////////////////////
	// Set markup visibility: to hide markup, set size to 0
	//
	/////////////////////////////////////////////////////////
	setMarkupVisibility(markupId, visible) {

		const markup = this.getMarkupById(markupId)

		markup.visible = visible

		this.updateMarkup(markup)
	}

	/////////////////////////////////////////////////////////
	// Set markup occlusion property
	//
	/////////////////////////////////////////////////////////
	setMarkupOcclusion(markupId, occlusion) {

		const markup = this.getMarkupById(markupId)

		markup.occlusion = occlusion

		this.updateMarkup(markup)
	}

	/////////////////////////////////////////////////////////
	// Update markup
	//
	/////////////////////////////////////////////////////////
	updateMarkup(markup) {

		if (markup.visible) {

			if (markup.occlusion) {

				const occluded = this.checkOcclusion(markup)

				this.setMarkupSize(markup.id,
					occluded ? 0.0 : markup.size,
					true)

			} else {

				this.setMarkupSize(markup.id,
					markup.size,
					true)
			}

		} else {

			this.setMarkupSize(markup.id,
				0.0, true)
		}
	}

	/////////////////////////////////////////////////////////
	// Get markups state
	//
	/////////////////////////////////////////////////////////
	getState() {

		return {
			markups: this.markups
		}
	}

	/////////////////////////////////////////////////////////
	// Restore state
	//
	/////////////////////////////////////////////////////////
	restoreState(state = {}) {

		this.clearMarkups()

		if (state.markups) {

			state.markups.forEach((markup) => {

				this.addMarkup(markup)
			})
		}
	}

	/////////////////////////////////////////////////////////
	// Camera Changed event handler
	//
	/////////////////////////////////////////////////////////
	onCameraChanged() {

		this.markups.forEach((markup) => {

			if (markup.visible && markup.occlusion) {

				const occluded = this.checkOcclusion(markup)

				this.setMarkupSize(markup.id,
					occluded ? 0.0 : markup.size,
					true)
			}
		})
	}

	/////////////////////////////////////////////////////////
	// Creates Raycaster object from client point
	//
	/////////////////////////////////////////////////////////
	pointToRaycaster(domElement, camera, point) {

		const pointerVector = new THREE.Vector3()
		const pointerDir = new THREE.Vector3()
		const ray = new THREE.Raycaster()

		const rect = domElement.getBoundingClientRect()

		const x = ((point.x - rect.left) / rect.width) * 2 - 1
		const y = -((point.y - rect.top) / rect.height) * 2 + 1

		if (camera.isPerspective) {

			pointerVector.set(x, y, 0.5)

			pointerVector.unproject(camera)

			ray.set(camera.position,
				pointerVector.sub(
					camera.position).normalize())

		} else {

			pointerVector.set(x, y, -1)

			pointerVector.unproject(camera)

			pointerDir.set(0, 0, -1)

			ray.set(pointerVector,
				pointerDir.transformDirection(
					camera.matrixWorld))
		}

		return ray
	}

	/////////////////////////////////////////////////////////
	// Returns array of selected markups for given screenPoint
	//
	/////////////////////////////////////////////////////////
	getSelection(screenPoint, treshold = 0.9) {

		const rayCaster = this.pointToRaycaster(
			this.viewer.impl.canvas,
			this.viewer.impl.camera, {
			x: screenPoint.x,
			y: screenPoint.y
		})

		const res = rayCaster.intersectObjects(
			[this.pointCloud], true)

		if (res.length) {

			return this.markups.filter((markup) => {

				const diff = {
					x: res[0].point.x - markup.point.x,
					y: res[0].point.y - markup.point.y,
					z: res[0].point.z - markup.point.z
				}

				const dist = Math.sqrt(
					diff.x * diff.x +
					diff.y * diff.y +
					diff.z * diff.z)

				return dist < treshold
			})
		}

		return []
	}


	getOffset(el) {
		const box = el.getBoundingClientRect()
		return {
			top: box.top + window.pageYOffset - document.documentElement.clientTop,
			left: box.left + window.pageXOffset - document.documentElement.clientLeft
		}
	}

	/////////////////////////////////////////////////////////
	// Occlusion check: return true if markup
	// is being occluded
	//
	/////////////////////////////////////////////////////////
	checkOcclusion(markup) {

		const clientPoint = this.viewer.worldToClient(
			markup.point)

		// const offset = $(this.viewer.container).offset()
		const offset = this.getOffset(this.viewer.container)

		const rayCaster = this.pointToRaycaster(
			this.viewer.impl.canvas,
			this.viewer.impl.camera, {
			x: clientPoint.x + offset.left,
			y: clientPoint.y + offset.top
		})

		const hitTest = this.viewer.model.rayIntersect(
			rayCaster, true, this.dbIds)

		if (hitTest) {

			if (hitTest.fragId === markup.fragId) {

				const offset = {
					x: hitTest.point.x - markup.point.x,
					y: hitTest.point.y - markup.point.y,
					z: hitTest.point.z - markup.point.z
				}

				const dist = Math.sqrt(
					offset.x * offset.x +
					offset.y * offset.y +
					offset.z * offset.z)

				if (this.options.logOcclusionDist) {

					console.log(dist)
				}

				if (dist < this.options.occlusionDist) {

					return false
				}
			}

			return true
		}
	}

	/////////////////////////////////////////////////////////
	// Get list of all dbIds in the model
	//
	/////////////////////////////////////////////////////////
	getAllDbIds() {

		const { instanceTree } = this.viewer.model.getData()

		const { dbIdToIndex } = instanceTree.nodeAccess

		return Object.keys(dbIdToIndex).map((dbId) => {

			return parseInt(dbId)
		})
	}

	/////////////////////////////////////////////////////////
	// Removes everything
	//
	/////////////////////////////////////////////////////////
	destroy() {

		this.viewer.impl.sceneAfter.remove(this.pointCloud)

		this.viewer.removeEventListener(
			Autodesk.Viewing.CAMERA_CHANGE_EVENT,
			this.onCameraChanged)

		this.markups = []

		this.off()
	}

	/**
 *
 * @param point {x,y,z} | THEE.Vector3  坐标
 * @param dbId
 * @param optionsElement? {innerHTML:string,className:string,others:Object<any>}
 */
	add(point, dbId, optionsElement, type = 1) {
		console.log(point, dbId)
		// Utils.getFragIdByDbId(this.viewer, dbId).then(fragId => {
		// 	console.log(fragId)
		// });
	}
}

Autodesk.Viewing.theExtensionManager.registerExtension(Markup3dExtension.ExtensionId, Markup3dExtension);