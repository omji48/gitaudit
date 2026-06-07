import { useEffect, useRef, useState } from 'react';
import { AuditResult } from '../types';
import { Download, Copy, Check, Share2, Linkedin, Twitter } from 'lucide-react';

export default function BadgeGenerator({ scoreData }: { scoreData: AuditResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper to draw rounded rectangles
    const drawRoundedRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    };

    // Canvas size: 600x400px, 2x pixel ratio for retina sharpness
    const width = 600;
    const height = 400;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${width}px`;
    ctx.scale(dpr, dpr);

    // Deep matte card background with soft radial lighting
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
    bgGrad.addColorStop(0, '#131417');
    bgGrad.addColorStop(1, '#090a0c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Left border premium gold gradient
    const borderGrad = ctx.createLinearGradient(0, 0, 0, height);
    borderGrad.addColorStop(0, '#e5c158');
    borderGrad.addColorStop(0.3, '#9a7b2c');
    borderGrad.addColorStop(0.7, '#cfa747');
    borderGrad.addColorStop(1, '#785e20');
    ctx.fillStyle = borderGrad;
    ctx.fillRect(0, 0, 5, height);

    // Outer card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // 1. Logo Block
    // Rounded G box with gold border
    ctx.strokeStyle = '#8e7544';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 40, 32, 34, 34, 6);
    ctx.stroke();

    ctx.fillStyle = '#e2d9c8';
    ctx.font = 'bold 20px \'Georgia\', \'Playfair Display\', \'Times New Roman\', serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', 57, 49);

    // GitAudit Text in uppercase Serif
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e2d9c8';
    ctx.font = 'bold 20px \'Georgia\', \'Playfair Display\', \'Times New Roman\', serif';
    ctx.fillText('GITAUDIT', 86, 56);

    // 2. Username Pill Badge
    ctx.font = 'bold 11px monospace';
    const usernameStr = `@${scoreData.username}`;
    const usernameWidth = ctx.measureText(usernameStr).width;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.strokeStyle = 'rgba(142, 117, 68, 0.3)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 40, 84, usernameWidth + 28, 24, 12);
    ctx.fill();
    ctx.stroke();

    // Active status dot (gold)
    ctx.fillStyle = '#cfa747';
    ctx.beginPath();
    ctx.arc(54, 96, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Username text
    ctx.fillStyle = '#e2d9c8';
    ctx.fillText(usernameStr, 64, 100);

    // 3. Large Score Number & /100
    ctx.fillStyle = '#e2d9c8';
    ctx.font = '90px \'Georgia\', \'Playfair Display\', \'Times New Roman\', serif';
    const scoreVal = scoreData.score.toString();
    ctx.fillText(scoreVal, 40, 205);
    const scoreWidth = ctx.measureText(scoreVal).width;

    ctx.fillStyle = 'rgba(226, 217, 200, 0.4)';
    ctx.font = '24px \'Georgia\', \'Playfair Display\', \'Times New Roman\', serif';
    ctx.fillText('/100', 40 + scoreWidth + 6, 205);

    // 4. Tier Badge Pill
    const tierEmoji = scoreData.tier_emoji || '⚡';
    const tierText = `${tierEmoji} ${scoreData.tier.toUpperCase()} TIER`;
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    const tierTextWidth = ctx.measureText(tierText).width;

    ctx.strokeStyle = 'rgba(142, 117, 68, 0.4)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 40, 230, tierTextWidth + 20, 24, 6);
    ctx.stroke();

    ctx.fillStyle = '#cfa747';
    ctx.fillText(tierText, 50, 246);

    // 5. Skills Tags (gold borders)
    let skillX = 40;
    let skillY = 282;
    const skills = (scoreData.skills || []).slice(0, 3);
    skills.forEach((skill) => {
      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      const skillText = skill.toUpperCase();
      const skillWidth = ctx.measureText(skillText).width;
      const tagWidth = skillWidth + 16;

      // If drawing this tag would overflow the left panel boundary (panelX = 278, leaving a safety margin),
      // wrap it to a second row.
      if (skillX + tagWidth > 268) {
        skillX = 40;
        skillY += 26; // Move to the next row (height 20 + 6px spacing)
      }

      ctx.strokeStyle = 'rgba(142, 117, 68, 0.2)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, skillX, skillY, tagWidth, 20, 4);
      ctx.stroke();

      ctx.fillStyle = '#c2b9a7';
      ctx.fillText(skillText, skillX + 8, skillY + 13);

      skillX += tagWidth + 8; // 8px spacing between tags
    });


    // 6. Right Side Panel Box
    const panelX = 278;
    const panelY = 28;
    const panelWidth = 292;
    const panelHeight = 344;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.strokeStyle = 'rgba(142, 117, 68, 0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.fill();
    ctx.stroke();

    // 7. Right Panel Rows (4 dimensions)
    const contentYStart = panelY + 16;
    const rowHeight = 78;
    const progressWidth = 210;
    const progressHeight = 6;
    const progressX = 344;
    const valX = 554;
    const circleCenterX = 314;

    const topDimensions = scoreData.dimensions.slice(0, 4);
    topDimensions.forEach((dim, i) => {
      const y = contentYStart + (i * rowHeight);
      const circleCenterY = y + 18;

      // Circular Vector Icon Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.strokeStyle = 'rgba(142, 117, 68, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(circleCenterX, circleCenterY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Custom Vector Icon Drawings
      const cx = circleCenterX;
      const cy = circleCenterY;
      
      if (i === 0) {
        // Document Icon (README)
        ctx.strokeStyle = '#cfa747';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 8);
        ctx.lineTo(cx + 2, cy - 8);
        ctx.lineTo(cx + 6, cy - 4);
        ctx.lineTo(cx + 6, cy + 8);
        ctx.lineTo(cx - 5, cy + 8);
        ctx.closePath();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy - 8);
        ctx.lineTo(cx + 2, cy - 4);
        ctx.lineTo(cx + 6, cy - 4);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy + 0); ctx.lineTo(cx + 3, cy + 0);
        ctx.moveTo(cx - 2, cy + 4); ctx.lineTo(cx + 3, cy + 4);
        ctx.stroke();
      } else if (i === 1) {
        // Code Icon (Commit Consistency)
        ctx.strokeStyle = '#cfa747';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - 4);
        ctx.lineTo(cx - 8, cy);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.moveTo(cx + 4, cy - 4);
        ctx.lineTo(cx + 8, cy);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.moveTo(cx + 2, cy - 7);
        ctx.lineTo(cx - 2, cy + 7);
        ctx.stroke();
      } else if (i === 2) {
        // People Icon (Project Diversity)
        ctx.strokeStyle = '#cfa747';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - 3, cy + 7, 6, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 1, 2.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 9, 5, Math.PI, 0);
        ctx.stroke();
      } else {
        // User Icon (Profile Completeness)
        ctx.strokeStyle = '#cfa747';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + 8, 7, Math.PI, 0);
        ctx.stroke();
      }

      // Label (dim name)
      ctx.fillStyle = '#a19e95';
      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      ctx.fillText(dim.name.toUpperCase(), progressX, y + 10);

      // Value text (right-aligned)
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(dim.score * 10)}%`, valX, y + 10);
      ctx.textAlign = 'left';

      // Bar track (background)
      ctx.fillStyle = '#18191c';
      drawRoundedRect(ctx, progressX, y + 20, progressWidth, progressHeight, 3);
      ctx.fill();

      // Bar fill (gold gradient)
      if (dim.score > 0) {
        const fillWidth = Math.max(6, (dim.score / 10) * progressWidth);
        const barGrad = ctx.createLinearGradient(progressX, 0, progressX + progressWidth, 0);
        barGrad.addColorStop(0, '#9a7b2c');
        barGrad.addColorStop(1, '#e5c158');
        ctx.fillStyle = barGrad;
        drawRoundedRect(ctx, progressX, y + 20, fillWidth, progressHeight, 3);
        ctx.fill();
      }

      // Row divider (except last row)
      if (i < 3) {
        ctx.strokeStyle = 'rgba(142, 117, 68, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(circleCenterX - 16, y + rowHeight - 14);
        ctx.lineTo(valX, y + rowHeight - 14);
        ctx.stroke();
      }
    });

    // 8. Footer URL / Watermark
    // Globe icon in footer
    const gx = 48;
    const gy = 354;
    ctx.strokeStyle = '#9a7b2c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx - 6, gy);
    ctx.lineTo(gx + 6, gy);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(gx, gy, 3, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#9a7b2c';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`gitaudit.com / @${scoreData.username}`, gx + 14, gy + 4);

  }, [scoreData]);

  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    setShareSupported(!!navigator.share && !!navigator.canShare);
  }, []);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitaudit-${scoreData.username}.png`;
    a.click();
  };

  const handleCopy = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
    });
  };

  const handleNativeShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], `gitaudit-${scoreData.username}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `GitAudit - @${scoreData.username}`,
            text: `My GitHub audit score is ${scoreData.score}/100 (${scoreData.tier} Tier) via GitAudit! 🔍⚡\n\nAudit yours at:`,
            url: window.location.origin
          });
        }
      } catch (err) {
        console.error('Error sharing:', err);
      }
    });
  };

  const handleShareX = () => {
    const text = `My GitHub audit score is ${scoreData.score}/100 (${scoreData.tier} Tier) via GitAudit! 🔍⚡\n\nAudit yours at:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.origin)}`;
    window.open(url, '_blank');
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-8 bg-bg-card border border-line p-8 pb-10 w-full mt-10">
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">Share Score</h3>
        <p className="opacity-70 serif text-sm italic">Generate a shareable badge for LinkedIn or X.</p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="rounded overflow-hidden border border-line shrink-0 max-w-full relative shadow-xl">
          <canvas ref={canvasRef} />
        </div>
        
        <div className="flex flex-col gap-6 w-full md:max-w-xs">
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleDownload} 
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-accent text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all w-full"
            >
              <Download className="w-4 h-4" /> Download Badge
            </button>
            
            <button 
              onClick={handleCopy} 
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-transparent border border-line text-white font-bold text-xs uppercase tracking-widest hover:bg-white/5 active:scale-95 transition-all w-full"
            >
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied Image!' : 'Copy to Clipboard'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-line flex-1"></div>
            <span className="text-[10px] uppercase tracking-wider text-app-text opacity-40 font-bold">Or Share To</span>
            <div className="h-px bg-line flex-1"></div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleShareX}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 border border-line hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-all"
              title="Share text on X (Twitter)"
            >
              <Twitter className="w-4 h-4 text-[#1da1f2]" /> X / Twitter
            </button>

            <button 
              onClick={handleShareLinkedIn}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 border border-line hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-all"
              title="Share link on LinkedIn"
            >
              <Linkedin className="w-4 h-4 text-[#0a66c2]" /> LinkedIn
            </button>

            {shareSupported && (
              <button 
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent/10 border border-accent/20 hover:bg-accent/20 text-accent text-xs font-bold uppercase tracking-wider transition-all"
                title="Share image using your device sharing options"
              >
                <Share2 className="w-4 h-4" /> Share to Apps
              </button>
            )}
          </div>

          <div className="p-4 bg-accent/5 border border-accent/15 rounded text-[11px] leading-relaxed text-app-text/75 font-serif italic">
            💡 <strong>Pro Tip:</strong> Click <strong>"Copy to Clipboard"</strong> above first, then click <strong>"X / Twitter"</strong> and paste (Ctrl+V or Cmd+V) to include the badge image directly in your post!
          </div>
        </div>
      </div>
    </div>
  );
}
