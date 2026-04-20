import { useMemo, useRef, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { WorldObject } from "../../state";
import { getInteractableDisplayImageSrc, getInteractableImageObjectPosition } from "./interactableImage";

const LEAF_IMAGES = [
  "/Sound Files/Animation PNGs/Leaves/dry_leaf05_diff.png",
  "/Sound Files/Animation PNGs/Leaves/dry_leaf06_diff.png",
  "/Sound Files/Animation PNGs/Leaves/dry_leaf11_diff.png",
];

interface LeafParticle {
  id: number;
  image: string;
  startX: number;
  driftX: number;
  delay: number;
  duration: number;
  rotation: number;
  size: number;
}

interface BloodParticle {
  id: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
}

function generateLeafParticles(seed: string): LeafParticle[] {
  // Simple hash from seed string for deterministic randomness
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) | 0;
    return ((h >>> 16) & 0x7fff) / 0x7fff;
  };

  const count = 5 + Math.floor(rand() * 4); // 5-8 leaves
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    image: LEAF_IMAGES[Math.floor(rand() * LEAF_IMAGES.length)],
    startX: 15 + rand() * 70,     // 15%-85% horizontal start
    driftX: -30 + rand() * 60,    // -30px to +30px drift
    delay: rand() * 0.3,          // 0-300ms stagger
    duration: 0.6 + rand() * 0.5, // 0.6-1.1s fall time
    rotation: rand() * 360,       // random initial rotation
    size: 10 + rand() * 8,        // 10-18px
  }));
}

function createSeededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return () => {
    h = (h * 1103515245 + 12345) | 0;
    return ((h >>> 16) & 0x7fff) / 0x7fff;
  };
}

function generateBloodParticles(seed: string): BloodParticle[] {
  const rand = createSeededRandom(seed);
  const count = 8 + Math.floor(rand() * 5);
  return Array.from({ length: count }, (_, i) => {
    const angle = -150 + rand() * 120;
    const distance = 18 + rand() * 46;
    return {
      id: i,
      startX: 38 + rand() * 24,
      startY: 38 + rand() * 18,
      driftX: Math.cos((angle * Math.PI) / 180) * distance,
      driftY: Math.sin((angle * Math.PI) / 180) * distance + rand() * 26,
      delay: rand() * 0.08,
      duration: 0.42 + rand() * 0.22,
      size: 4 + rand() * 7,
      opacity: 0.62 + rand() * 0.3,
    };
  });
}

interface InteractableCardProps {
  object: WorldObject;
  selected: boolean;
  successChance: number;
  statusEffects?: Array<{
    id: string;
    name: string;
    color: string;
    iconImage?: string;
    stacks: number;
    remainingMs?: number;
    progressPct?: number;
  }>;
  hostileCast?: {
    name: string;
    progressPct: number;
    elapsedLabel: string;
    color?: string;
  };
  impactText?: {
    id: string;
    text: string;
  };
  emoteCue?: {
    id: string;
    text: string;
    durationMs: number;
  };
  leafParticleKey?: string;
  bloodParticleKey?: string;
  isAttackAnimating?: boolean;
  isHitShaking?: boolean;
  isExtinguishing?: boolean;
  shouldReveal?: boolean;
  revealDelay?: number;
  onClick: () => void;
}

export function InteractableCard({
  object,
  selected,
  successChance,
  statusEffects = [],
  hostileCast,
  impactText,
  emoteCue,
  leafParticleKey,
  bloodParticleKey,
  isAttackAnimating,
  isHitShaking,
  isExtinguishing,
  shouldReveal,
  revealDelay,
  onClick,
}: InteractableCardProps) {
  const imageSrc = getInteractableDisplayImageSrc(object);
  const leafParticles = useMemo(
    () => (leafParticleKey ? generateLeafParticles(leafParticleKey) : null),
    [leafParticleKey],
  );
  const bloodParticles = useMemo(
    () => (bloodParticleKey ? generateBloodParticles(bloodParticleKey) : null),
    [bloodParticleKey],
  );
  const cardRef = useRef<HTMLButtonElement>(null);
  const [particleRect, setParticleRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if ((leafParticleKey || bloodParticleKey) && cardRef.current) {
      setParticleRect(cardRef.current.getBoundingClientRect());
    } else {
      setParticleRect(null);
    }
  }, [leafParticleKey, bloodParticleKey]);

  const hasImage = Boolean(imageSrc);
  const integrityPct = object.maxIntegrity > 0
    ? Math.max(0, Math.min(100, (object.integrity / object.maxIntegrity) * 100))
    : 0;
  const isNpc = Boolean(object.dialogueId || (object.dialogueRoutes?.length ?? 0) > 0);
  const isHostile = object.tag === "enemy";

  return (
    <>
    <button
      ref={cardRef}
      type="button"
      className={`interactable-card ${selected ? "is-selected" : ""} ${isHostile ? "is-hostile" : ""} ${isAttackAnimating ? "is-attacking" : ""} ${isHitShaking ? "is-hit-shaking" : ""} ${isExtinguishing ? "is-extinguishing" : ""} ${shouldReveal ? "is-reveal-in" : ""}`}
      style={shouldReveal ? { animationDelay: `${revealDelay}ms` } : undefined}
      disabled={isExtinguishing}
      onClick={onClick}
    >
      <div className="interactable-card-header">
        <div
          className="interactable-card-header-fill"
          style={{ width: `${integrityPct}%`, background: object.barColor }}
        />
        <div className="interactable-card-header-content">
          <span className="interactable-card-name">{object.name}</span>
          <span className="interactable-card-hp">
            {Math.ceil(object.integrity)} / {object.maxIntegrity} {object.meterLabel?.toUpperCase() ?? "HP"}
          </span>
          {!isNpc ? (
            <span className="interactable-card-chance">{successChance}% Success Rate</span>
          ) : null}
        </div>
      </div>

      {statusEffects.length > 0 ? (
        <div className="interactable-status-strip" aria-label={`${object.name} status effects`}>
          {statusEffects.slice(0, 6).map((effect) => (
            <div
              key={`${object.id}_${effect.id}`}
              className="interactable-status-badge"
              style={{ backgroundImage: "url(/status-effect-rectangle.png)" }}
              title={effect.name}
            >
              <div className="interactable-status-badge-shell">
                <div
                  className="interactable-status-badge-icon"
                  style={effect.iconImage ? { backgroundImage: `url(${effect.iconImage})` } : { color: effect.color }}
                >
                  {!effect.iconImage ? effect.name.slice(0, 2).toUpperCase() : null}
                </div>
                {effect.progressPct !== undefined ? (
                  <div
                    className="interactable-status-badge-cooldown"
                    style={{ transform: `scaleY(${Math.max(0, Math.min(100, effect.progressPct)) / 100})` }}
                  />
                ) : null}
                {effect.remainingMs !== undefined ? (
                  <div className="interactable-status-badge-timer">
                    {effect.remainingMs >= 10000
                      ? `${Math.ceil(effect.remainingMs / 1000)}`
                      : (effect.remainingMs / 1000).toFixed(1)}
                  </div>
                ) : null}
                {effect.stacks > 1 ? (
                  <div className="interactable-status-badge-stacks">{effect.stacks}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {hasImage ? (
        <div className="interactable-card-media">
          <img
            src={imageSrc}
            alt={object.name}
            className="interactable-card-image"
            style={{
              objectPosition: getInteractableImageObjectPosition(object.imagePositionX, object.imagePositionY),
            }}
          />
        </div>
      ) : null}

      {!hasImage && <div className="interactable-card-empty" />}

      {hostileCast ? (
        <div
          className="interactable-castbar"
          aria-live="polite"
          style={
            hostileCast.color
              ? ({
                  "--interactable-cast-color": hostileCast.color,
                } as CSSProperties)
              : undefined
          }
        >
          <div
            className="interactable-castbar-fill"
            style={{ width: `${hostileCast.progressPct}%` }}
          />
          <div className="interactable-castbar-content">
            <span className="interactable-castbar-name">{hostileCast.name}</span>
            <span className="interactable-castbar-timer">{hostileCast.elapsedLabel}</span>
          </div>
        </div>
      ) : null}

      {impactText ? (
        <div key={impactText.id} className="interactable-impact-text">
          {impactText.text}
        </div>
      ) : null}

      {emoteCue ? (
        <div
          key={emoteCue.id}
          className="interactable-emote-bubble"
          aria-live="polite"
          style={{ animationDuration: `${emoteCue.durationMs}ms` }}
        >
          <span>{emoteCue.text}</span>
        </div>
      ) : null}

    </button>

    {leafParticles && particleRect
      ? createPortal(
          <div
            key={leafParticleKey}
            className="leaf-particle-container"
            aria-hidden="true"
            style={{
              position: "fixed",
              left: particleRect.left,
              top: particleRect.top,
              width: particleRect.width,
              height: particleRect.height,
            }}
          >
            {leafParticles.map((leaf) => (
              <img
                key={leaf.id}
                src={leaf.image}
                alt=""
                className="leaf-particle"
                style={{
                  left: `${leaf.startX}%`,
                  width: leaf.size,
                  height: leaf.size,
                  animationDelay: `${leaf.delay}s`,
                  animationDuration: `${leaf.duration}s`,
                  "--leaf-drift": `${leaf.driftX}px`,
                  "--leaf-rotation": `${leaf.rotation}deg`,
                } as CSSProperties}
              />
            ))}
          </div>,
          document.body,
        )
      : null}
    {bloodParticles && particleRect
      ? createPortal(
          <div
            key={bloodParticleKey}
            className="blood-particle-container"
            aria-hidden="true"
            style={{
              position: "fixed",
              left: particleRect.left,
              top: particleRect.top,
              width: particleRect.width,
              height: particleRect.height,
            }}
          >
            {bloodParticles.map((drop) => (
              <span
                key={drop.id}
                className="blood-particle"
                style={{
                  left: `${drop.startX}%`,
                  top: `${drop.startY}%`,
                  width: drop.size,
                  height: drop.size,
                  animationDelay: `${drop.delay}s`,
                  animationDuration: `${drop.duration}s`,
                  "--blood-drift-x": `${drop.driftX}px`,
                  "--blood-drift-y": `${drop.driftY}px`,
                  "--blood-opacity": drop.opacity,
                } as CSSProperties}
              />
            ))}
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
