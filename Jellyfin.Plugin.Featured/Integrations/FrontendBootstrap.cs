using Newtonsoft.Json;

namespace Jellyfin.Plugin.Featured;

internal static class FrontendBootstrap
{
    internal const string StartMarker = "<!-- Jellyfin Featured bootstrap start -->";
    internal const string EndMarker = "<!-- Jellyfin Featured bootstrap end -->";

    internal static string BuildHtml(PluginConfiguration configuration)
        => configuration.EnableFrontendBootstrap
            ? $"{StartMarker}<script>{BuildScript(configuration)}</script>{EndMarker}"
            : string.Empty;

    internal static string BuildScript(PluginConfiguration configuration)
    {
        if (!configuration.EnableFrontendBootstrap)
        {
            return string.Empty;
        }

        string settings = JsonConvert.SerializeObject(new
        {
            hero = configuration.UseHeroLayout,
            hideOnTv = configuration.HideOnTvLayout,
            heightMode = configuration.HeroHeightMode,
            desktopHeight = configuration.BannerHeight,
            tabletHeight = configuration.TabletBannerHeight,
            mobileHeight = configuration.MobileBannerHeight,
            radius = configuration.HeroBorderRadius,
            mediaPadding = configuration.MediaPadding,
            heroOverlap = FeaturedLayout.GetHeroOverlap(FeaturedLayout.GetDesktopHeight(configuration)),
            heading = configuration.Heading
        }, new JsonSerializerSettings { StringEscapeHandling = StringEscapeHandling.EscapeHtml });

        return $$$"""
            (() => {
                'use strict';
                if (window.JellyfinFeaturedBootstrap) return;
                const settings = {{{settings}}};
                const selector = '#indexPage:not(.hide) #homeTab.is-active .homeSectionsContainer, #homeTab.is-active .homeSectionsContainer';
                const style = document.createElement('style');
                style.id = 'jellyfin-featured-bootstrap-styles';
                style.textContent = `
                    #homeTab.ec-bootstrap-hero-page{padding-top:0!important;transform:translateY(-120px)}
                    .ec-bootstrap-placeholder{--ec-height:360px;--ec-tablet-height:400px;--ec-mobile-height:340px;box-sizing:border-box;margin:30px 0 calc(2.2em + var(--ec-media-padding,0px));position:relative;width:100%;pointer-events:none}
                    .ec-bootstrap-placeholder:not(.ec-bootstrap-hero){padding-left:max(env(safe-area-inset-left),3.3%);padding-right:max(env(safe-area-inset-right),3.3%)}
                    .ec-bootstrap-placeholder.ec-bootstrap-hero{margin-bottom:calc((var(--ec-hero-overlap,100px) * -1) + 52px + var(--ec-media-padding,0px));margin-top:0}
                    .ec-bootstrap-heading{margin:0 0 .55em;overflow:hidden;padding-right:10rem;text-overflow:ellipsis;white-space:nowrap}
                    .ec-bootstrap-viewport{animation:ec-bootstrap-shimmer 1.5s ease-in-out infinite;background:linear-gradient(105deg,#141414 20%,#202020 38%,#141414 56%);background-size:220% 100%;border-radius:var(--ec-radius,0);height:var(--ec-height);min-height:240px;opacity:.72;overflow:hidden;width:100%}
                    .ec-bootstrap-height-auto{--ec-height:clamp(360px,46vw,750px)}.ec-bootstrap-height-compact{--ec-height:360px}.ec-bootstrap-height-standard{--ec-height:500px}.ec-bootstrap-height-cinematic{--ec-height:750px}
                    @keyframes ec-bootstrap-shimmer{from{background-position:100% 0}to{background-position:-120% 0}}
                    @media(max-width:1000px){.ec-bootstrap-placeholder{--ec-height:var(--ec-tablet-height)!important;--ec-hero-overlap:100px!important}}
                    @media(max-width:700px){.ec-bootstrap-placeholder{--ec-height:var(--ec-mobile-height)!important;--ec-hero-overlap:75px!important}}
                    @media(prefers-reduced-motion:reduce){.ec-bootstrap-viewport{animation:none}}
                `;
                (document.head || document.documentElement).appendChild(style);

                let scheduled = false;
                const scan = () => {
                    scheduled = false;
                    document.querySelectorAll('.ec-bootstrap-placeholder').forEach(element => {
                        if (!element.parentElement?.matches(selector)) element.remove();
                    });
                    document.querySelectorAll(selector).forEach(container => {
                        if ((settings.hideOnTv && document.documentElement.classList.contains('layout-tv'))
                            || container.querySelector(':scope > .ec-root, :scope > .ec-bootstrap-placeholder')) return;
                        const placeholder = document.createElement('section');
                        placeholder.className = `ec-bootstrap-placeholder ec-bootstrap-height-${settings.heightMode}${settings.hero ? ' ec-bootstrap-hero' : ''}`;
                        placeholder.setAttribute('aria-hidden', 'true');
                        if (settings.heightMode === 'custom') placeholder.style.setProperty('--ec-height', `${settings.desktopHeight}px`);
                        placeholder.style.setProperty('--ec-tablet-height', `${settings.tabletHeight}px`);
                        placeholder.style.setProperty('--ec-mobile-height', `${settings.mobileHeight}px`);
                        placeholder.style.setProperty('--ec-hero-overlap', `${settings.heroOverlap}px`);
                        if (!settings.hero) placeholder.style.setProperty('--ec-radius', `${settings.radius}px`);
                        placeholder.style.setProperty('--ec-media-padding', `${settings.mediaPadding}px`);
                        if (settings.heading && !settings.hero) {
                            const heading = document.createElement('h2');
                            heading.className = 'sectionTitle sectionTitle-cards ec-bootstrap-heading';
                            heading.textContent = settings.heading;
                            placeholder.appendChild(heading);
                        }
                        const viewport = document.createElement('div');
                        viewport.className = 'ec-bootstrap-viewport';
                        placeholder.appendChild(viewport);
                        container.prepend(placeholder);
                        container.closest('#homeTab')?.classList.toggle('ec-bootstrap-hero-page', settings.hero);
                    });
                };
                const schedule = () => {
                    if (scheduled) return;
                    scheduled = true;
                    requestAnimationFrame(scan);
                };
                const observer = new MutationObserver(schedule);
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
                window.JellyfinFeaturedBootstrap = {
                    stop() {
                        observer.disconnect();
                    }
                };
                schedule();
            })();
            """;
    }
}
