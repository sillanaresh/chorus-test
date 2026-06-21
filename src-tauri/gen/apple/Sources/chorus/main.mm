#import <UIKit/UIKit.h>
#import <objc/runtime.h>

#include "bindings/bindings.h"

static IMP chorus_original_input_assistant_item = nil;
static BOOL chorus_input_assistant_override_installed = NO;

static UIView *chorus_input_accessory_view(id self, SEL selector) {
	return nil;
}

static UITextInputAssistantItem *chorus_input_assistant_item(id self, SEL selector) {
	UITextInputAssistantItem *(*original)(id, SEL) =
		(UITextInputAssistantItem *(*)(id, SEL))chorus_original_input_assistant_item;
	UITextInputAssistantItem *assistant = original(self, selector);
	assistant.leadingBarButtonGroups = @[];
	assistant.trailingBarButtonGroups = @[];
	return assistant;
}

static void chorus_install_input_assistant_override(void) {
	if (chorus_input_assistant_override_installed) {
		return;
	}

	Class contentViewClass = NSClassFromString(@"WKContentView");
	Method method = class_getInstanceMethod(
		contentViewClass,
		@selector(inputAssistantItem)
	);
	if (contentViewClass == nil || method == nil) {
		return;
	}

	chorus_original_input_assistant_item = method_getImplementation(method);
	method_setImplementation(method, (IMP)chorus_input_assistant_item);

	Method accessoryMethod = class_getInstanceMethod(
		contentViewClass,
		@selector(inputAccessoryView)
	);
	if (accessoryMethod != nil) {
		method_setImplementation(
			accessoryMethod,
			(IMP)chorus_input_accessory_view
		);
	}
	chorus_input_assistant_override_installed = YES;
}

static void chorus_clear_input_assistant_in_view(UIView *view) {
	UITextInputAssistantItem *assistant = view.inputAssistantItem;
	assistant.leadingBarButtonGroups = @[];
	assistant.trailingBarButtonGroups = @[];

	for (UIView *subview in view.subviews) {
		chorus_clear_input_assistant_in_view(subview);
	}
}

static void chorus_clear_input_assistants(void) {
	chorus_install_input_assistant_override();
	for (UIWindow *window in UIApplication.sharedApplication.windows) {
		chorus_clear_input_assistant_in_view(window);
	}
}

static void chorus_clear_input_assistants_after(NSTimeInterval delay) {
	dispatch_after(
		dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
		dispatch_get_main_queue(),
		^{
			chorus_clear_input_assistants();
		}
	);
}

static void chorus_install_keyboard_observers(void) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
		void (^clearAssistant)(NSNotification *) = ^(NSNotification *notification) {
			chorus_clear_input_assistants();
			chorus_clear_input_assistants_after(0.05);
			chorus_clear_input_assistants_after(0.2);
			chorus_clear_input_assistants_after(0.5);
		};

		[center addObserverForName:UIKeyboardWillShowNotification
						  object:nil
						   queue:NSOperationQueue.mainQueue
					  usingBlock:clearAssistant];
		[center addObserverForName:UIKeyboardWillChangeFrameNotification
						  object:nil
						   queue:NSOperationQueue.mainQueue
					  usingBlock:clearAssistant];
		[center addObserverForName:UIKeyboardDidShowNotification
						  object:nil
						   queue:NSOperationQueue.mainQueue
					  usingBlock:clearAssistant];
		chorus_clear_input_assistants();
	});
}

int main(int argc, char * argv[]) {
	chorus_install_keyboard_observers();
	ffi::start_app();
	return 0;
}
