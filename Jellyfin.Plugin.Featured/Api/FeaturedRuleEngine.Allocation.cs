using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.Featured.Api;

internal sealed partial class FeaturedRuleEngine
{
    private static void AllocateQuotas(
        List<FeaturedRulePool> pools,
        int requestedCount,
        bool enforceSourceMaximum)
    {
        if (requestedCount <= 0 || pools.Count == 0) return;

        foreach (FeaturedRulePool pool in pools)
        {
            int available = pool.Items.Count + pool.Stats.Returned;
            int maximum = enforceSourceMaximum && pool.Rule.MaximumItems > 0
                ? Math.Min(pool.Rule.MaximumItems, available)
                : available;
            pool.Quota = Math.Min(maximum, Math.Max(pool.Stats.Returned, pool.Rule.MinimumItems));
        }

        int assigned = pools.Sum(pool => Math.Max(0, pool.Quota - pool.Stats.Returned));
        if (assigned > requestedCount)
        {
            foreach (FeaturedRulePool pool in pools.OrderByDescending(pool => pool.Index))
            {
                int reduction = Math.Min(pool.Quota - pool.Stats.Returned, assigned - requestedCount);
                pool.Quota -= reduction;
                assigned -= reduction;
                if (assigned == requestedCount) break;
            }
        }

        int remaining = requestedCount - assigned;
        while (remaining > 0)
        {
            FeaturedRulePool? next = pools
                .Where(pool => pool.Quota < pool.Items.Count + pool.Stats.Returned
                    && (!enforceSourceMaximum || pool.Rule.MaximumItems == 0 || pool.Quota < pool.Rule.MaximumItems))
                .OrderBy(pool => (double)(pool.Quota + 1) / pool.Rule.Weight)
                .ThenBy(pool => pool.Index)
                .FirstOrDefault();
            if (next is null) break;
            next.Quota += 1;
            remaining -= 1;
        }

        foreach (FeaturedRulePool pool in pools)
        {
            pool.Stats.Allocated = Math.Max(pool.Stats.Allocated, pool.Quota);
        }
    }

    private static void FillFromPools(
        List<FeaturedRulePool> pools,
        int requestedCount,
        List<BaseItem> result,
        HashSet<string> selectedKeys,
        FeaturedDiversityTracker diversity,
        Dictionary<Guid, FeaturedItemSelectionReason> itemReasons,
        bool enforceDiversity,
        bool enforceSourceMaximum,
        bool cooldownRelaxed = false)
    {
        while (result.Count < requestedCount)
        {
            int resultCountBeforePass = result.Count;
            AllocateQuotas(pools, requestedCount - result.Count, enforceSourceMaximum);
            while (result.Count < requestedCount)
            {
                FeaturedRulePool? pool = pools
                    .Where(candidate => candidate.Items.Count > 0
                        && candidate.Stats.Returned < candidate.Quota
                        && (!enforceSourceMaximum
                            || candidate.Rule.MaximumItems == 0
                            || candidate.Stats.Returned < candidate.Rule.MaximumItems))
                    .OrderBy(candidate => (double)(candidate.Stats.Returned + 1) / Math.Max(1, candidate.Quota))
                    .ThenBy(candidate => candidate.Index)
                    .FirstOrDefault();
                if (pool is null) break;
                TryAddNext(pool, result, selectedKeys, diversity, itemReasons, enforceDiversity, cooldownRelaxed);
            }

            // Reallocate quota donated by exhausted or duplicate-heavy pools.
            if (result.Count == resultCountBeforePass) break;
        }
    }

    private static bool TryAddNext(
        FeaturedRulePool pool,
        List<BaseItem> result,
        HashSet<string> selectedKeys,
        FeaturedDiversityTracker diversity,
        Dictionary<Guid, FeaturedItemSelectionReason> itemReasons,
        bool enforceDiversity,
        bool cooldownRelaxed)
    {
        while (pool.Items.TryDequeue(out BaseItem? item))
        {
            string identity = GetItemIdentity(item);
            if (selectedKeys.Contains(identity))
            {
                pool.Stats.Duplicates += 1;
                continue;
            }

            if (enforceDiversity && !diversity.CanAdd(item))
            {
                pool.DeferredItems.Enqueue(item);
                pool.Stats.DiversitySkipped += 1;
                continue;
            }

            selectedKeys.Add(identity);
            diversity.Record(item);
            result.Add(item);
            itemReasons[item.Id] = new FeaturedItemSelectionReason(
                pool.Rule.Id,
                pool.Rule.Type,
                pool.Rule.AllowBackgroundTrailers,
                pool.Rule.UseTrickplayFallback,
                pool.Rule.UseMediaPreviewFallback);
            pool.Stats.Returned += 1;
            if (cooldownRelaxed) pool.Stats.CooldownRelaxed += 1;
            return true;
        }

        return false;
    }

    private static void RestoreDeferred(IEnumerable<FeaturedRulePool> pools)
    {
        foreach (FeaturedRulePool pool in pools)
        {
            while (pool.DeferredItems.TryDequeue(out BaseItem? item)) pool.Items.Enqueue(item);
        }
    }

    private static void ActivateCooldownItems(IEnumerable<FeaturedRulePool> pools)
    {
        foreach (FeaturedRulePool pool in pools)
        {
            while (pool.CooldownItems.TryDequeue(out BaseItem? item)) pool.Items.Enqueue(item);
        }
    }

    private static string GetItemIdentity(BaseItem item)
    {
        foreach (string provider in new[] { "Tmdb", "Imdb", "Tvdb", "MusicBrainzAlbum" })
        {
            if (item.ProviderIds.TryGetValue(provider, out string? value) && !string.IsNullOrWhiteSpace(value))
            {
                return $"{item.GetBaseItemKind()}:{provider}:{value}";
            }
        }

        return $"{item.GetBaseItemKind()}:{item.Name?.Trim()}:{item.ProductionYear}";
    }
}
