namespace Lexforge.SelectionMonitor;

internal sealed class InputReadScheduler
{
    private readonly long quietDelayMs;
    private readonly long idleRefreshMs;
    private IntPtr lastWindow;
    private uint lastInputTick;
    private long dueAt;
    private long lastReadAt;
    private bool pending = true;
    private bool initialized;

    internal InputReadScheduler(long quietDelayMs, long idleRefreshMs)
    {
        this.quietDelayMs = quietDelayMs;
        this.idleRefreshMs = idleRefreshMs;
    }

    internal void Reset() => initialized = false;

    internal bool ShouldRead(long now, IntPtr window, uint inputTick)
    {
        if (!initialized || window != lastWindow || inputTick != lastInputTick)
        {
            initialized = true;
            lastWindow = window;
            lastInputTick = inputTick;
            dueAt = now + quietDelayMs;
            pending = true;
        }

        if (pending)
        {
            if (now < dueAt) return false;
            pending = false;
            lastReadAt = now;
            return true;
        }

        if (now - lastReadAt < idleRefreshMs) return false;
        lastReadAt = now;
        return true;
    }
}
