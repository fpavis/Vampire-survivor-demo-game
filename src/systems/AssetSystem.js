import * as PIXI from 'pixi.js';
import { STYLES, ENEMY_TYPES } from '../core/config.js';
import { gameState } from '../core/gameState.js';

export class AssetSystem {
    constructor(app) {
        this.app = app;
    }

    async loadAssets() {
        console.log('Loading game assets...');
        
        try {
            const defaultColors = {
                player: 0x00ff88,
                enemy: 0xFF0000,
                rangedEnemy: 0x00FF00,
                bullet: 0xffdd00,
                portal: 0x00ffff
            };

            const colors = {
                player: STYLES.colors?.player || defaultColors.player,
                enemy: ENEMY_TYPES.BASIC?.color || defaultColors.enemy,
                rangedEnemy: ENEMY_TYPES.FAST?.color || defaultColors.rangedEnemy,
                bullet: STYLES.colors?.bullet || defaultColors.bullet,
                portal: defaultColors.portal
            };

            const assetManifest = {};

            for (const [name, color] of Object.entries({
                player: colors.player,
                playerGlow: colors.player,
                basicEnemy: colors.enemy,
                rangedEnemy: colors.rangedEnemy,
                eliteGlow: 0xFFD700,
                bullet: colors.bullet,
                bulletGlow: colors.bullet,
                portal: colors.portal,
                portalGlow: colors.portal,
                healEffect: 0x00FF00
            })) {
                const isGlow = name.includes('Glow');
                const radius = this.getRadiusForAsset(name);
                const canvas = isGlow ? 
                    this.createGlowTexture(radius, color) : 
                    this.createCircleTexture(radius, color);
                
                if (!canvas || !canvas.width || !canvas.height) {
                    console.error(`Invalid canvas for ${name}:`, canvas);
                    continue;
                }
                
                const dataUrl = canvas.toDataURL('image/png');
                
                assetManifest[name] = {
                    src: dataUrl,
                    data: { 
                        type: isGlow ? 'glow' : 'circle',
                        width: canvas.width,
                        height: canvas.height,
                        color: color
                    }
                };
            }

            await PIXI.Assets.init({
                manifest: {
                    bundles: [{
                        name: 'game-textures',
                        assets: assetManifest
                    }]
                }
            });

            try {
                const textures = await PIXI.Assets.loadBundle('game-textures');
                
                const validatedTextures = {};
                for (const [name, texture] of Object.entries(textures)) {
                    if (texture && texture.valid !== false && texture.width > 0 && texture.height > 0) {
                        validatedTextures[name] = texture;
                    } else {
                        console.error(`Invalid texture loaded for ${name}:`, texture);
                    }
                }
                
                console.log('Loaded and validated textures:', Object.keys(validatedTextures));
                return validatedTextures;
            } catch (error) {
                console.error('Failed to load textures:', error);
                throw error;
            }
        } catch (error) {
            console.error('Asset loading error:', error);
            throw error;
        }
    }

    getRadiusForAsset(name) {
        const radiusMap = {
            player: 20,
            playerGlow: 25,
            basicEnemy: 20,
            rangedEnemy: 20,
            eliteGlow: 25,
            bullet: 5,
            bulletGlow: 8,
            portal: 40,
            portalGlow: 45,
            healEffect: 30
        };
        return radiusMap[name] || 20;
    }

    createCircleTexture(radius, color) {
        const canvas = document.createElement('canvas');
        const size = radius * 2;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, size, size);

        ctx.beginPath();
        ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fill();

        ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 1;
        ctx.stroke();

        return canvas;
    }

    createGlowTexture(radius, color) {
        const canvas = document.createElement('canvas');
        const size = radius * 2;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, size, size);

        const gradient = ctx.createRadialGradient(
            radius, radius, 0,
            radius, radius, radius
        );

        const colorHex = `#${color.toString(16).padStart(6, '0')}`;
        gradient.addColorStop(0, colorHex + 'FF');
        gradient.addColorStop(0.3, colorHex + 'B3');
        gradient.addColorStop(0.6, colorHex + '66');
        gradient.addColorStop(0.8, colorHex + '33');
        gradient.addColorStop(1, colorHex + '00');

        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        return canvas;
    }
} 