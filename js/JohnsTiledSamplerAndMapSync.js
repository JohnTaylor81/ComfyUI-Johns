import { app } from "/scripts/app.js";

app.registerExtension({
	name: "JohnsTiledSamplerAndMapSync",

	nodeCreated(node) {

		const SYNC_FIELDS = [
			"TraversalMode",
			"HorizontalTiles",
			"VerticalTiles",
			"SeamRefinement"
		];

		function getWidget(node, name) {
			return node.widgets?.find(w => w.name === name);
		}

		function findPairedNode(node) {
			if (!node.graph) return null;

			const inputLinks  = node.inputs?.map(i => i.link).filter(id => id != null) || [];
			const outputLinks = node.outputs?.flatMap(o => o.links).filter(id => id != null) || [];
			const allLinks    = [...inputLinks, ...outputLinks];

			for (const linkId of allLinks) {
				const link = node.graph.links[linkId];

				if (!link) continue;

				const origin = node.graph.getNodeById(link.origin_id);
				const target = node.graph.getNodeById(link.target_id);
				const other  = (origin?.id === node.id) ? target : origin;

				if (!other) continue;

				if (
					(node.comfyClass === "JohnsTiledSampler"     && other.comfyClass === "JohnsTileDiffusionMap") ||
					(node.comfyClass === "JohnsTileDiffusionMap" && other.comfyClass === "JohnsTiledSampler")
				) {
					return other;
				}
			}

			return null;
		}

		function syncTo(source, target) {
			if (!source || !target) return;

			if (source.SyncLock) return;

			source.SyncLock = true;

			SYNC_FIELDS.forEach(name => {
				const s = getWidget(source, name);
				const t = getWidget(target, name);

				if (s && t && t.value !== s.value) {
					t.value = s.value;
					t.callback?.(t.value);
				}
			});

			if (typeof target.updateOutputs === "function") {
				target.updateOutputs();
			}
			
			source.IsSynced = true;
			target.IsSynced = true;

			const now = performance.now();

			source.PulseDuration = now + 600;
			target.PulseDuration = now + 600;
			source.TransferTo    = target.id;
			target.TransferTo    = null;

			target.setDirtyCanvas(true);
			source.setDirtyCanvas(true);
			app.graphcanvas?.setDirty(true, true);

			source.SyncLock = false;
		}

		const origWidgetChanged = node.onWidgetChanged;

		node.onWidgetChanged = function (...args) {
			if (origWidgetChanged) {
				origWidgetChanged.apply(this, args);
			}

			const other = findPairedNode(this);
			if (other) {
				syncTo(this, other);
			}
		};

		const origConnections = node.onConnectionsChange;

		node.onConnectionsChange = function (...args) {
			if (origConnections) {
				origConnections.apply(this, args);
			}

			const other = findPairedNode(this);
			if (other) {
				syncTo(this, other);
			} else {
				this.IsSynced      = false;
				this.TransferTo    = null;
				this.PulseDuration = null;
				this.setDirtyCanvas(true);
				app.graphcanvas?.setDirty(true, true);
			}
		};

		const origDrawForeground = node.onDrawForeground;

		function getEdgeCenter(a, b) {
			if (!a || !b || !a.pos || !b.pos || !a.size || !b.size) return null;

			const aEdges = {
				left:   [a.pos[0],  a.pos[1]    + a.size[1] / 2],
				right:  [a.pos[0] + a.size[0],     a.pos[1] + a.size[1] / 2],
				top:    [a.pos[0] + a.size[0] / 2, a.pos[1] - 30],
				bottom: [a.pos[0] + a.size[0] / 2, a.pos[1] + a.size[1]]
			};

			const bEdges = {
				left:   [b.pos[0],  b.pos[1]    + b.size[1] / 2],
				right:  [b.pos[0] + b.size[0],     b.pos[1] + b.size[1] / 2],
				top:    [b.pos[0] + b.size[0] / 2, b.pos[1] - 30],
				bottom: [b.pos[0] + b.size[0] / 2, b.pos[1] + b.size[1]]
			};

			let minDist  = Infinity;
			let bestPair = null;

			for (const aKey in aEdges) {
				for (const bKey in bEdges) {

					const aIsVertical = (aKey === "left" || aKey === "right");
					const bIsVertical = (bKey === "left" || bKey === "right");

					if (aIsVertical !== bIsVertical) continue;

					const ax = aEdges[aKey][0];
					const ay = aEdges[aKey][1];
					const bx = bEdges[bKey][0];
					const by = bEdges[bKey][1];

					const dx   = bx - ax;
					const dy   = by - ay;
					const dist = dx * dx + dy * dy;

					if (dist < minDist) {
						minDist  = dist;
						bestPair = {
							start: [ax, ay],
							end: [bx, by]
						};
					}
				}
			}

			return bestPair;
		}

		const SynchedColor      = 'rgba(60,  160, 160, 1)';
		const NotSynchedColor   = 'rgba(180, 0,   0,   1)';
		const ParticleTailColor = 'rgba(70,  180, 190, 0)';

		const clampNumber = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));

		function drawParticleFlow(ctx, node, now) {
			if (!node.TransferTo || !node.graph) return;

			const other = node.graph.getNodeById(node.TransferTo);

			if (!other) return;

			const pair = getEdgeCenter(node, other);

			if (!pair) return;

			const { start, end } = pair;

			ctx.save();
			ctx.translate(-node.pos[0], -node.pos[1]);

			const dx     = end[0] - start[0];
			const dy     = end[1] - start[1];
			const length = Math.hypot(dx, dy);

			if (length < 10) {
				ctx.restore();
				return;
			}

			const dirX = dx / length;
			const dirY = dy / length;

			const particleCount = clampNumber((length / 100), 3, 10);
			const baseSpeed     = clampNumber((length * 0.0001), 0.0001, 0.0004);

			for (let i = 0; i < particleCount; i++) {
				let   t          = ((now * baseSpeed) + (i / particleCount)) % 1;
				const accelT     = (1 - Math.cos(t * Math.PI)) / 2;
				const px         = start[0] + dx * accelT;
				const py         = start[1] + dy * accelT;
				const velocity   = Math.sin(t * Math.PI);
				const streakLen  = 40 * velocity;
				const tipX       = px - dirX * streakLen;
				const tipY       = py - dirY * streakLen;
				const edgeFade   = Math.min(t / 0.15, (1 - t) / 0.15, 1);
				const finalAlpha = Math.max(0, edgeFade);
				const fade       = Math.sin(t * Math.PI);
				const radius     = 2.5;
				const nx         = -dirY * radius;
				const ny         = dirX * radius;
				const gradient   = ctx.createLinearGradient(tipX, tipY, px, py);

				gradient.addColorStop(0, ParticleTailColor);
				gradient.addColorStop(1, SynchedColor);

				ctx.globalAlpha = 0.6 * finalAlpha;
				ctx.fillStyle   = gradient;

				ctx.beginPath();
				ctx.moveTo(tipX, tipY);
				ctx.lineTo(px + nx, py + ny);
				ctx.lineTo(px - nx, py - ny);
				ctx.closePath();
				ctx.fill();

				ctx.globalAlpha = 0.25 + fade * 0.6;
				ctx.fillStyle   = SynchedColor;

				ctx.beginPath();
				ctx.arc(px, py, radius, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.restore();
		}

		node.onDrawForeground = function (ctx) {
			if (this.comfyClass !== "JohnsTileDiffusionMap" && this.comfyClass !== "JohnsTiledSampler") {
				if (origDrawForeground) {
					origDrawForeground.call(this, ctx);
				}
				return;
			}

			if (origDrawForeground) {
				origDrawForeground.call(this, ctx);
			}

			const now          = performance.now();
			const transferring = this.PulseDuration && now < this.PulseDuration;
			const synched      = this.IsSynced;

			let pulse         = 0;
			let glowIntensity = 0.3;

			if (transferring) {
				const duration  = 2500;
				const startTime = this.PulseDuration - duration;
				const progress  = Math.max(0, Math.min(1, (now - startTime) / duration));

				const fadeWindow = 0.2;
				let   fade       = 1;

				if (progress < fadeWindow) fade = progress / fadeWindow;
				else if (progress > (1 - fadeWindow)) fade = (1 - progress) / fadeWindow;

				pulse         = Math.sin((now % 500) / 500 * Math.PI) * fade;
				glowIntensity = glowIntensity + (0.4 + (pulse * 0.4)) * fade;
			}

			const x = (this.PulseDuration ? -pulse : 0) - 1;
			const y = (this.PulseDuration ? -pulse : 0) - 31;
			const w = this.size[0] + 2 + (this.PulseDuration ? pulse * 2 : 0);
			const h = this.size[1] + 32 + (this.PulseDuration ? pulse * 2 : 0);

			ctx.save();
			ctx.strokeStyle = synched ? SynchedColor : NotSynchedColor;
			ctx.lineWidth   = 2 + (pulse * 2);
			ctx.globalAlpha = glowIntensity;

			ctx.shadowColor   = synched ? SynchedColor : NotSynchedColor;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur    = transferring ? (10 + pulse * 10) : 12;

			ctx.beginPath();
			ctx.rect(x, y, w, h);
			ctx.stroke();

			ctx.restore();

			if (transferring && this.TransferTo) {
				drawParticleFlow(ctx, this, now);
				this.setDirtyCanvas(true);
				app.graphcanvas?.setDirty(true, true);
			}
		};
	}
});
