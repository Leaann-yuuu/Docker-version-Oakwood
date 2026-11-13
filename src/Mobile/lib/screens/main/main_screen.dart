import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/notification_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/custom_floating_nav_bar.dart';
import '../../widgets/modals/notification_detail_dialog.dart';
import 'profile_screen.dart';
import 'resident_home_screen.dart';
import 'resident_notifications_screen.dart';
import 'resident_visitors_screen.dart';

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen>
    with WidgetsBindingObserver {
  int _currentIndex = 0;
  Timer? _pollTimer;
  bool _isPolling = false;
  bool _isInitialFetchDone = false;
  final Set<int> _knownNotificationIds = {};
  final List<NotificationModel> _pendingNotificationPopups = [];
  bool _isShowingPopup = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startPolling();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _knownNotificationIds.clear();
    _pendingNotificationPopups.clear();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _pollNotifications();
    }
  }

  void _startPolling() {
    // Initial poll after widget is laid out
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _pollNotifications();
    });

    // Periodic poll every 3.5 seconds to auto-detect incoming notifications
    _pollTimer = Timer.periodic(const Duration(milliseconds: 3500), (_) {
      _pollNotifications();
    });
  }

  Future<void> _pollNotifications() async {
    if (!mounted || _isPolling) return;

    final user = ref.read(authProvider).value;
    if (user == null) return;

    _isPolling = true;

    try {
      final latestList =
          await ref.read(residentServiceProvider).getNotifications();
      if (!mounted) return;

      if (!_isInitialFetchDone) {
        // Record all initial notifications so we do not pop up historical ones on launch
        _knownNotificationIds.addAll(latestList.map((n) => n.id));
        _isInitialFetchDone = true;
        return;
      }

      // Detect newly arrived, unread notifications
      final newUnread = latestList
          .where((n) => !_knownNotificationIds.contains(n.id) && !n.isRead)
          .toList();

      // Record all IDs in known set
      for (final n in latestList) {
        _knownNotificationIds.add(n.id);
      }

      if (newUnread.isNotEmpty) {
        // Automatically refresh providers so lists, badges, and home screen update with no refresh needed
        ref.invalidate(notificationsProvider);
        ref.invalidate(myVisitorRequestsProvider);
        ref.invalidate(myGateLogsProvider);

        // Queue incoming notifications for automatic pop-up
        _pendingNotificationPopups.addAll(newUnread);
        _triggerNextNotificationPopup();
      } else {
        // Also check if count changed (e.g. read status updated) to keep badge in sync
        final currentNotifs = ref.read(notificationsProvider).value;
        if (currentNotifs != null &&
            currentNotifs.length != latestList.length) {
          ref.invalidate(notificationsProvider);
        }
      }
    } catch (_) {
      // Ignore background network hiccups
    } finally {
      if (mounted) {
        _isPolling = false;
      }
    }
  }

  Future<void> _triggerNextNotificationPopup() async {
    if (!mounted || _isShowingPopup || _pendingNotificationPopups.isEmpty) {
      return;
    }

    final notif = _pendingNotificationPopups.removeAt(0);
    _isShowingPopup = true;

    // Physical vibration feedback for incoming notification
    try {
      HapticFeedback.heavyImpact();
    } catch (_) {}

    try {
      await NotificationDetailDialog.show(
        context,
        notification: notif,
        onMarkedRead: () {
          ref.invalidate(notificationsProvider);
        },
        onDeleted: () {
          ref.invalidate(notificationsProvider);
        },
      );
    } catch (_) {
      // Ignored if navigator context changes
    } finally {
      if (mounted) {
        _isShowingPopup = false;
        if (_pendingNotificationPopups.isNotEmpty) {
          Future.delayed(
            const Duration(milliseconds: 350),
            _triggerNextNotificationPopup,
          );
        }
      }
    }
  }

  void _onNavigateTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final notifsAsync = ref.watch(notificationsProvider);
    final hasUnreadNotifs = notifsAsync.maybeWhen(
      data: (list) => list.any((n) => !n.isRead),
      orElse: () => false,
    );

    final visitorsAsync = ref.watch(myVisitorRequestsProvider);
    final hasPendingVisitors = visitorsAsync.maybeWhen(
      data: (list) => list.any((r) => r.isPendingWalkin),
      orElse: () => false,
    );

    final tabs = [
      ResidentHomeScreen(
        onNavigateTab: _onNavigateTab,
        isActive: _currentIndex == 0,
      ),
      const ResidentVisitorsScreen(),
      const ResidentNotificationsScreen(),
      ProfileScreen(isActive: _currentIndex == 3),
    ];

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      extendBody: true,
      body: IndexedStack(index: _currentIndex, children: tabs),
      bottomNavigationBar: CustomFloatingBottomNavBar(
        selectedIndex: _currentIndex,
        onItemSelected: (i) => setState(() => _currentIndex = i),
        items: [
          const NavItemData(
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            label: 'Home',
          ),
          NavItemData(
            icon: Icons.people_outline_rounded,
            selectedIcon: Icons.people_rounded,
            label: 'Visitors',
            hasBadge: hasPendingVisitors,
          ),
          NavItemData(
            icon: Icons.notifications_outlined,
            selectedIcon: Icons.notifications_rounded,
            label: 'Alerts',
            hasBadge: hasUnreadNotifs,
          ),
          const NavItemData(
            icon: Icons.person_outline,
            selectedIcon: Icons.person_rounded,
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

